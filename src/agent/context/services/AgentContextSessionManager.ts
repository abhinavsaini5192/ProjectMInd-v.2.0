import type {
  IAgentContextSessionManager,
  StartTaskContextResult,
  GetCurrentContextOptions,
  GetCurrentContextResult,
  UpdateTaskContextParams,
  ScopeValidationParams,
  ExecutionReportResult,
} from '../interfaces/IAgentContextSessionManager.js';
import type { IAgentContextStore } from '../interfaces/IAgentContextStore.js';
import type { IAgentContextPinManager } from '../interfaces/IAgentContextPinManager.js';
import type { IAgentContextDeltaCalculator } from '../interfaces/IAgentContextDeltaCalculator.js';
import type { IAgentContextInvalidator } from '../interfaces/IAgentContextInvalidator.js';
import type { IAgentContextRefresher, RefreshContextOptions, RefreshContextResult } from '../interfaces/IAgentContextRefresher.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { AgentContextSession, CreateContextSessionParams } from '../models/AgentContextSession.js';
import type { AgentTask } from '../models/AgentTask.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { ContextPin, CreatePinParams } from '../models/ContextPin.js';
import type { ContextFeedback, ContextFeedbackParams } from '../models/ContextFeedback.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';
import type { AgentExecutionReport, AgentExecutionReportParams } from '../models/AgentExecutionReport.js';
import { createEmptyChangeSet } from '../models/AgentChangeSet.js';
import { AgentContextEventType } from '../events/AgentContextEvents.js';
import {
  ContextSessionNotFoundError,
  TaskNotFoundError,
  ContextScopeError,
} from '../errors/AgentContextError.js';
import type { ContextRequest } from '../../../context/models/ContextRequest.js';
import type { ContextSection } from '../../../context/models/ContextSection.js';

export interface AgentContextSessionManagerDependencies {
  readonly store: IAgentContextStore;
  readonly pinManager: IAgentContextPinManager;
  readonly deltaCalculator: IAgentContextDeltaCalculator;
  readonly invalidator: IAgentContextInvalidator;
  readonly refresher: IAgentContextRefresher;
  readonly contextOrchestrator: IContextOrchestrator;
  readonly sessionManager?: IAgentSessionManager | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export class AgentContextSessionManager implements IAgentContextSessionManager {
  private readonly inFlightRefreshes = new Map<string, Promise<RefreshContextResult>>();

  constructor(private readonly deps: AgentContextSessionManagerDependencies) {}

  // 1. Session & Task Lifecycle
  public async startTaskContext(params: CreateContextSessionParams): Promise<StartTaskContextResult> {
    return this.createContextSession(params);
  }

  public async createContextSession(params: CreateContextSessionParams): Promise<StartTaskContextResult> {
    // Validate session scope via AgentSessionManager if present
    if (this.deps.sessionManager) {
      const session = await this.deps.sessionManager.getSession(params.agentSessionId);
      if (session) {
        const sessionWorkspaceId = (session as any).workspaceContext?.workspaceId ?? (session as any).workspaceId;
        const sessionRepositoryId = (session as any).workspaceContext?.repositoryId ?? (session as any).repositoryId;
        if (sessionWorkspaceId && sessionWorkspaceId !== params.workspaceId) {
          throw new ContextScopeError(
            `Workspace mismatch: agent session belongs to workspace '${sessionWorkspaceId}', but request specified '${params.workspaceId}'`
          );
        }
        if (sessionRepositoryId && sessionRepositoryId !== params.repositoryId) {
          throw new ContextScopeError(
            `Repository mismatch: agent session belongs to repository '${sessionRepositoryId}', but request specified '${params.repositoryId}'`
          );
        }
      }
    }

    const timestamp = Date.now();
    const taskId = params.taskId ?? `task_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;
    const contextSessionId = `cs_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;

    // 1. Create Task
    const task: AgentTask = {
      taskId,
      contextSessionId,
      agentSessionId: params.agentSessionId,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      title: params.taskTitle ?? params.taskText.substring(0, 80),
      description: params.taskText,
      intent: params.taskIntent ?? 'IMPLEMENTATION',
      status: 'READY',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: params.metadata ?? {},
    };

    // 2. Query initial context from Context Orchestrator
    const initialRequest: ContextRequest = {
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      taskText: params.taskText,
      featureIds: params.featureIds ? Array.from(params.featureIds) : undefined,
      resourceIds: params.resourceIds ? Array.from(params.resourceIds) : undefined,
      changedResources: params.changedResources ? Array.from(params.changedResources) : undefined,
      tokenBudget: params.tokenBudget ?? 8000,
      requestedSections: params.requestedSections as ContextSection[] | undefined,
      compactMode: params.compactMode ?? false,
      freshnessPolicy: params.freshnessPolicy ?? 'CURRENT',
    };

    const orchestratorResponse = await this.deps.contextOrchestrator.orchestrateContext(initialRequest);
    const contextPackage = orchestratorResponse.package;

    const initialContextVersion = 1;
    const initialKnowledgeVersion = contextPackage.version?.knowledgeVersion ?? '1.0.0';

    // 3. Create Context Session
    const contextSession: AgentContextSession = {
      contextSessionId,
      agentSessionId: params.agentSessionId,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      taskId,
      taskText: params.taskText,
      taskIntent: task.intent,
      status: 'ACTIVE',
      currentContextVersion: initialContextVersion,
      currentKnowledgeVersion: initialKnowledgeVersion,
      currentContextPackageId: contextPackage.packageId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastContextRefreshAt: new Date(),
      metadata: params.metadata ?? {},
    };

    // 4. Create Initial Context State
    const contextState: AgentContextState = {
      selectedFeatures: contextPackage.features.map((f) => f.featureId),
      selectedResources: contextPackage.resources.map((r) => r.path ?? r.resourceId),
      includedSections: ['ARCHITECTURE', 'RESOURCES', 'DEPENDENCIES', 'BEHAVIOR', 'TESTS'],
      omittedSections: [],
      currentContextPackageId: contextPackage.packageId,
      contextVersion: initialContextVersion,
      knowledgeVersion: initialKnowledgeVersion,
      freshness: 'CURRENT',
      staleSections: [],
      warnings: contextPackage.warnings?.map((w) => w.message) ?? [],
      lastRefreshReason: 'EXPLICIT_REQUEST',
    };

    // 5. Store artifacts
    await this.deps.store.saveTask(task);
    await this.deps.store.saveSession(contextSession);
    await this.deps.store.saveState(contextSessionId, contextState);
    await this.deps.store.saveContextPackage(contextSessionId, initialContextVersion, contextPackage);

    // 6. Emit Events
    this.deps.eventBus?.publish(AgentContextEventType.TASK_CREATED, {
      taskId,
      contextSessionId,
      agentSessionId: params.agentSessionId,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      timestamp,
      data: { title: task.title },
    });

    this.deps.eventBus?.publish(AgentContextEventType.SESSION_CREATED, {
      contextSessionId,
      agentSessionId: params.agentSessionId,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      timestamp,
      data: { taskId, contextVersion: initialContextVersion },
    });

    return {
      task,
      contextSession,
      contextPackage,
      warnings: contextState.warnings,
      freshness: 'CURRENT',
      versionMetadata: {
        contextVersion: initialContextVersion,
        knowledgeVersion: initialKnowledgeVersion,
      },
    };
  }

  public async getContextSession(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession | undefined> {
    const session = await this.deps.store.getSession(contextSessionId);
    if (!session) return undefined;
    this.validateScope(session, scope);
    return session;
  }

  public async getTask(
    taskId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentTask | undefined> {
    const task = await this.deps.store.getTask(taskId);
    if (!task) return undefined;
    if (scope?.workspaceId && task.workspaceId !== scope.workspaceId) {
      throw new ContextScopeError(`Task belongs to a different workspace`);
    }
    if (scope?.repositoryId && task.repositoryId !== scope.repositoryId) {
      throw new ContextScopeError(`Task belongs to a different repository`);
    }
    return task;
  }

  public async getTaskForContextSession(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentTask | undefined> {
    const session = await this.requireSession(contextSessionId, scope);
    return this.deps.store.getTask(session.taskId);
  }

  public async updateContextSession(
    contextSessionId: string,
    updates: Partial<Pick<AgentContextSession, 'status' | 'metadata'>>,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession> {
    const session = await this.requireSession(contextSessionId, scope);
    const updated: AgentContextSession = {
      ...session,
      status: updates.status ?? session.status,
      metadata: updates.metadata ? { ...session.metadata, ...updates.metadata } : session.metadata,
      updatedAt: new Date(),
    };
    await this.deps.store.saveSession(updated);

    this.deps.eventBus?.publish(AgentContextEventType.SESSION_UPDATED, {
      contextSessionId,
      agentSessionId: session.agentSessionId,
      workspaceId: session.workspaceId,
      repositoryId: session.repositoryId,
      timestamp: Date.now(),
      data: { status: updated.status },
    });

    return updated;
  }

  public async pauseContextSession(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession> {
    return this.updateContextSession(contextSessionId, { status: 'PAUSED' }, scope);
  }

  public async resumeContextSession(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession> {
    return this.updateContextSession(contextSessionId, { status: 'ACTIVE' }, scope);
  }

  public async completeContextSession(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession> {
    const session = await this.updateContextSession(contextSessionId, { status: 'COMPLETED' }, scope);
    const task = await this.deps.store.getTask(session.taskId);
    if (task) {
      const completedTask: AgentTask = {
        ...task,
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      };
      await this.deps.store.saveTask(completedTask);

      this.deps.eventBus?.publish(AgentContextEventType.TASK_COMPLETED, {
        taskId: task.taskId,
        contextSessionId,
        agentSessionId: session.agentSessionId,
        timestamp: Date.now(),
        data: {},
      });
    }
    return session;
  }

  public async cancelContextSession(
    contextSessionId: string,
    reason?: string | undefined,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession> {
    const session = await this.updateContextSession(
      contextSessionId,
      {
        status: 'CANCELLED',
        metadata: { cancellationReason: reason },
      },
      scope
    );

    const task = await this.deps.store.getTask(session.taskId);
    if (task) {
      const cancelledTask: AgentTask = {
        ...task,
        status: 'CANCELLED',
        updatedAt: new Date(),
        metadata: { ...task.metadata, cancellationReason: reason },
      };
      await this.deps.store.saveTask(cancelledTask);

      this.deps.eventBus?.publish(AgentContextEventType.TASK_FAILED, {
        taskId: task.taskId,
        contextSessionId,
        agentSessionId: session.agentSessionId,
        timestamp: Date.now(),
        data: { reason },
      });
    }
    return session;
  }

  public async markContextStale(
    contextSessionId: string,
    reason: ContextRefreshReason,
    scope?: ScopeValidationParams
  ): Promise<void> {
    const session = await this.requireSession(contextSessionId, scope);
    const state = await this.deps.store.getState(contextSessionId);
    if (state) {
      const updatedState: AgentContextState = {
        ...state,
        freshness: 'STALE',
        lastRefreshReason: reason,
      };
      await this.deps.store.saveState(contextSessionId, updatedState);
    }

    const updatedSession: AgentContextSession = {
      ...session,
      status: 'STALE',
      updatedAt: new Date(),
    };
    await this.deps.store.saveSession(updatedSession);

    this.deps.eventBus?.publish(AgentContextEventType.SESSION_STALE, {
      contextSessionId,
      agentSessionId: session.agentSessionId,
      timestamp: Date.now(),
      data: { reason },
    });
  }

  // 2. Context Operations
  public async getCurrentContext(
    contextSessionId: string,
    options?: GetCurrentContextOptions,
    scope?: ScopeValidationParams
  ): Promise<GetCurrentContextResult> {
    const session = await this.requireSession(contextSessionId, scope);
    const state = await this.deps.store.getState(contextSessionId);
    let pkg = await this.deps.store.getContextPackage(contextSessionId);

    if (!pkg) {
      throw new ContextSessionNotFoundError(`No context package stored for session '${contextSessionId}'`);
    }

    let wasRefreshed = false;
    // Auto-refresh if context is marked stale or partially stale
    const isStale = state?.freshness === 'STALE' || state?.freshness === 'PARTIALLY_STALE';
    if (isStale && options?.autoRefreshIfStale !== false) {
      const refreshResult = await this.refreshContextSession(contextSessionId, {
        reason: state?.lastRefreshReason ?? 'STALE_CONTEXT',
      }, scope);
      pkg = refreshResult.package;
      wasRefreshed = true;
    }

    const updatedSession = (await this.deps.store.getSession(contextSessionId)) ?? session;
    const currentState = (await this.deps.store.getState(contextSessionId)) ?? state;

    // Context Delta if requested
    let delta;
    if (options?.includeDelta) {
      const baseVersion = options.baseContextVersion ?? 1;
      const targetVersion = updatedSession.currentContextVersion;
      if (baseVersion < targetVersion) {
        const basePkg = await this.deps.store.getContextPackage(contextSessionId, baseVersion);
        if (basePkg) {
          delta = this.deps.deltaCalculator.computeDelta(
            basePkg,
            pkg,
            currentState?.lastRefreshReason ?? 'UNKNOWN',
            contextSessionId,
            baseVersion,
            targetVersion
          );
        }
      }
    }

    return {
      contextSession: updatedSession,
      contextPackage: pkg,
      contextVersion: updatedSession.currentContextVersion,
      freshness: currentState?.freshness ?? 'CURRENT',
      wasRefreshed,
      delta,
      warnings: currentState?.warnings ?? [],
    };
  }

  public async refreshContextSession(
    contextSessionId: string,
    options?: RefreshContextOptions,
    scope?: ScopeValidationParams
  ): Promise<RefreshContextResult> {
    // Concurrency / duplicate refresh deduplication
    const activeRefresh = this.inFlightRefreshes.get(contextSessionId);
    if (activeRefresh) {
      return activeRefresh;
    }

    const refreshPromise = this.performRefresh(contextSessionId, options ?? {}, scope);
    this.inFlightRefreshes.set(contextSessionId, refreshPromise);

    try {
      return await refreshPromise;
    } finally {
      this.inFlightRefreshes.delete(contextSessionId);
    }
  }

  private async performRefresh(
    contextSessionId: string,
    options: RefreshContextOptions,
    scope?: ScopeValidationParams
  ): Promise<RefreshContextResult> {
    const session = await this.requireSession(contextSessionId, scope);
    const state = await this.deps.store.getState(contextSessionId);
    const currentPackage = await this.deps.store.getContextPackage(contextSessionId);

    if (!state || !currentPackage) {
      throw new ContextSessionNotFoundError(`State or package missing for session '${contextSessionId}'`);
    }

    const pinnedFeatures = await this.deps.pinManager.getPinnedFeatureIds(contextSessionId);
    const pinnedResources = await this.deps.pinManager.getPinnedResourceIds(contextSessionId);

    // Perform smart refresh
    const refreshResult = await this.deps.refresher.refreshContext(
      session,
      state,
      currentPackage,
      options,
      pinnedFeatures,
      pinnedResources
    );

    // Compute and persist ContextDelta
    const delta = this.deps.deltaCalculator.computeDelta(
      currentPackage,
      refreshResult.package,
      refreshResult.reason,
      contextSessionId,
      refreshResult.previousVersion,
      refreshResult.refreshedVersion
    );
    await this.deps.store.saveDelta(delta);

    // Update session
    const updatedSession: AgentContextSession = {
      ...session,
      currentContextVersion: refreshResult.refreshedVersion,
      currentContextPackageId: refreshResult.package.packageId,
      status: 'ACTIVE',
      lastContextRefreshAt: new Date(),
      updatedAt: new Date(),
    };
    await this.deps.store.saveSession(updatedSession);

    // Update state
    const updatedState: AgentContextState = {
      ...state,
      contextVersion: refreshResult.refreshedVersion,
      currentContextPackageId: refreshResult.package.packageId,
      selectedFeatures: refreshResult.package.features.map((f) => f.featureId),
      selectedResources: refreshResult.package.resources.map((r) => r.path ?? r.resourceId),
      freshness: 'CURRENT',
      staleSections: [],
      lastRefreshReason: refreshResult.reason,
    };
    await this.deps.store.saveState(contextSessionId, updatedState);

    // Store new package
    await this.deps.store.saveContextPackage(
      contextSessionId,
      refreshResult.refreshedVersion,
      refreshResult.package
    );

    // Publish event
    this.deps.eventBus?.publish(AgentContextEventType.CONTEXT_REFRESHED, {
      contextSessionId,
      agentSessionId: session.agentSessionId,
      timestamp: Date.now(),
      data: {
        previousVersion: refreshResult.previousVersion,
        refreshedVersion: refreshResult.refreshedVersion,
        reason: refreshResult.reason,
        reusedSections: refreshResult.reusedSections,
        rebuiltSections: refreshResult.rebuiltSections,
      },
    });

    return refreshResult;
  }

  public async updateTaskContext(
    contextSessionId: string,
    params: UpdateTaskContextParams,
    scope?: ScopeValidationParams
  ): Promise<GetCurrentContextResult> {
    const session = await this.requireSession(contextSessionId, scope);
    const task = await this.deps.store.getTask(session.taskId);
    if (!task) throw new TaskNotFoundError(session.taskId);

    // Update task description / intent
    const updatedTask: AgentTask = {
      ...task,
      title: params.newTitle ?? task.title,
      description: params.newTaskText ?? task.description,
      intent: params.newIntent ?? task.intent,
      updatedAt: new Date(),
    };
    await this.deps.store.saveTask(updatedTask);

    // Update context session task text
    const updatedSession: AgentContextSession = {
      ...session,
      taskText: params.newTaskText ?? session.taskText,
      taskIntent: params.newIntent ?? session.taskIntent,
      updatedAt: new Date(),
    };
    await this.deps.store.saveSession(updatedSession);

    this.deps.eventBus?.publish(AgentContextEventType.TASK_UPDATED, {
      taskId: task.taskId,
      contextSessionId,
      agentSessionId: session.agentSessionId,
      timestamp: Date.now(),
      data: { newTitle: updatedTask.title },
    });

    // Trigger refresh with TASK_CHANGED reason
    await this.refreshContextSession(contextSessionId, {
      reason: 'TASK_CHANGED',
      tokenBudget: params.tokenBudget,
      forceFullRefresh: false,
    }, scope);

    return this.getCurrentContext(contextSessionId, { includeDelta: true }, scope);
  }

  // 3. Execution & Invalidation
  public async reportExecution(
    params: AgentExecutionReportParams,
    scope?: ScopeValidationParams
  ): Promise<ExecutionReportResult> {
    const contextSessionId = params.contextSessionId;
    if (!contextSessionId) {
      throw new ContextScopeError(`Execution report requires a valid 'contextSessionId'`);
    }

    const session = await this.requireSession(contextSessionId, scope);
    const state = await this.deps.store.getState(contextSessionId);
    if (!state) {
      throw new ContextSessionNotFoundError(`State not found for context session '${contextSessionId}'`);
    }

    const timestamp = new Date();
    const reportId = `rep_${timestamp.getTime()}_${Math.random().toString(36).substring(2, 8)}`;
    const changedResources = Array.from(
      new Set([...(params.changedResources ?? []), ...(params.modifiedFiles ?? [])])
    );

    const changeSet = params.changeSet ?? {
      ...createEmptyChangeSet(),
      modifiedResources: changedResources,
    };

    const report: AgentExecutionReport = {
      reportId,
      taskId: params.taskId,
      contextSessionId,
      agentSessionId: session.agentSessionId,
      workspaceId: session.workspaceId,
      repositoryId: session.repositoryId,
      changedResources,
      operations: params.operations ?? [],
      status: params.status,
      summary: params.summary,
      timestamp,
      changeSet,
      metadata: params.metadata ?? {},
    };

    // Evaluate invalidation
    const pinnedFeatures = await this.deps.pinManager.getPinnedFeatureIds(contextSessionId);
    const pinnedResources = await this.deps.pinManager.getPinnedResourceIds(contextSessionId);

    const invalidation = await this.deps.invalidator.evaluateInvalidation(
      session,
      state,
      changeSet,
      pinnedFeatures,
      pinnedResources
    );

    let isStale = false;
    let newFreshness = state.freshness;

    if (invalidation.decision === 'PARTIAL_REFRESH_REQUIRED') {
      newFreshness = 'PARTIALLY_STALE';
      isStale = true;
    } else if (invalidation.decision === 'FULL_REFRESH_REQUIRED') {
      newFreshness = 'STALE';
      isStale = true;
    }

    // Update state if stale
    if (isStale) {
      const updatedState: AgentContextState = {
        ...state,
        freshness: newFreshness,
        staleSections: invalidation.staleSections,
        lastChangeSet: changeSet,
        lastRefreshReason: invalidation.reason,
      };
      await this.deps.store.saveState(contextSessionId, updatedState);

      this.deps.eventBus?.publish(AgentContextEventType.CONTEXT_INVALIDATED, {
        contextSessionId,
        agentSessionId: session.agentSessionId,
        timestamp: Date.now(),
        data: {
          decision: invalidation.decision,
          staleSections: invalidation.staleSections,
          affectedFeatures: invalidation.affectedFeatures,
        },
      });

      this.deps.eventBus?.publish(AgentContextEventType.SESSION_STALE, {
        contextSessionId,
        agentSessionId: session.agentSessionId,
        timestamp: Date.now(),
        data: { reason: invalidation.reason },
      });
    }

    // Update session lastReportedChangeAt
    const updatedSession: AgentContextSession = {
      ...session,
      status: isStale ? (newFreshness === 'PARTIALLY_STALE' ? 'STALE' : 'STALE') : session.status,
      lastReportedChangeAt: timestamp,
      updatedAt: timestamp,
    };
    await this.deps.store.saveSession(updatedSession);

    // Update Task Status if relevant
    const task = await this.deps.store.getTask(session.taskId);
    if (task) {
      let newTaskStatus = task.status;
      if (params.status === 'IN_PROGRESS' && task.status === 'READY') {
        newTaskStatus = 'IN_PROGRESS';
      } else if (params.status === 'COMPLETED' && task.status === 'IN_PROGRESS') {
        newTaskStatus = 'VERIFYING';
      }
      if (newTaskStatus !== task.status) {
        await this.deps.store.saveTask({
          ...task,
          status: newTaskStatus,
          updatedAt: timestamp,
        });
      }
    }

    return {
      report,
      invalidation,
      contextSession: updatedSession,
      isStale,
    };
  }

  // 4. Pinning
  public async pinContext(
    contextSessionId: string,
    params: Omit<CreatePinParams, 'contextSessionId'>,
    scope?: ScopeValidationParams
  ): Promise<ContextPin> {
    const session = await this.requireSession(contextSessionId, scope);
    const pin = await this.deps.pinManager.pin(session, {
      ...params,
      contextSessionId,
    });

    this.deps.eventBus?.publish(AgentContextEventType.CONTEXT_PINNED, {
      contextSessionId,
      agentSessionId: session.agentSessionId,
      timestamp: Date.now(),
      data: { pinId: pin.pinId, type: pin.type, targetId: pin.targetId },
    });

    return pin;
  }

  public async unpinContext(
    contextSessionId: string,
    pinId: string,
    scope?: ScopeValidationParams
  ): Promise<boolean> {
    const session = await this.requireSession(contextSessionId, scope);
    const success = await this.deps.pinManager.unpin(session, pinId);

    if (success) {
      this.deps.eventBus?.publish(AgentContextEventType.CONTEXT_UNPINNED, {
        contextSessionId,
        agentSessionId: session.agentSessionId,
        timestamp: Date.now(),
        data: { pinId },
      });
    }

    return success;
  }

  public async listPinnedContext(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<readonly ContextPin[]> {
    await this.requireSession(contextSessionId, scope);
    return this.deps.pinManager.listPins(contextSessionId);
  }

  // 5. Feedback
  public async recordFeedback(
    params: ContextFeedbackParams,
    scope?: ScopeValidationParams
  ): Promise<ContextFeedback> {
    const session = await this.requireSession(params.contextSessionId, scope);
    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const feedback: ContextFeedback = {
      feedbackId,
      contextSessionId: params.contextSessionId,
      agentSessionId: session.agentSessionId,
      rating: params.rating,
      missingFeatures: params.missingFeatures,
      missingResources: params.missingResources,
      unnecessaryResources: params.unnecessaryResources,
      missingSections: params.missingSections,
      comments: params.comments,
      recordedAt: new Date(),
    };

    await this.deps.store.saveFeedback(feedback);

    this.deps.eventBus?.publish(AgentContextEventType.FEEDBACK_RECEIVED, {
      contextSessionId: params.contextSessionId,
      agentSessionId: session.agentSessionId,
      timestamp: Date.now(),
      data: { rating: feedback.rating, feedbackId },
    });

    return feedback;
  }

  public async getContextState(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentContextState | undefined> {
    await this.requireSession(contextSessionId, scope);
    return this.deps.store.getState(contextSessionId);
  }

  // Helper validation
  private async requireSession(
    contextSessionId: string,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession> {
    const session = await this.deps.store.getSession(contextSessionId);
    if (!session) {
      throw new ContextSessionNotFoundError(contextSessionId);
    }
    this.validateScope(session, scope);
    return session;
  }

  private validateScope(session: AgentContextSession, scope?: ScopeValidationParams): void {
    if (!scope) return;
    if (scope.workspaceId && session.workspaceId !== scope.workspaceId) {
      throw new ContextScopeError(
        `Workspace isolation violation: session '${session.contextSessionId}' belongs to workspace '${session.workspaceId}', not '${scope.workspaceId}'`
      );
    }
    if (scope.repositoryId && session.repositoryId !== scope.repositoryId) {
      throw new ContextScopeError(
        `Repository isolation violation: session '${session.contextSessionId}' belongs to repository '${session.repositoryId}', not '${scope.repositoryId}'`
      );
    }
    if (scope.agentSessionId && session.agentSessionId !== scope.agentSessionId) {
      throw new ContextScopeError(
        `Agent session ownership violation: session '${session.contextSessionId}' belongs to agent session '${session.agentSessionId}', not '${scope.agentSessionId}'`
      );
    }
  }
}
