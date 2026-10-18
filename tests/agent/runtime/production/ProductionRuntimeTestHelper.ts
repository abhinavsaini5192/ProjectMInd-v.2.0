import type { IEventBus } from '../../../../src/workspace/interfaces/IEventBus.js';
import type { IAgentSessionManager } from '../../../../src/agent/interfaces/IAgentSessionManager.js';
import type { ITaskRuntime } from '../../../../src/agent/runtime/interfaces/ITaskRuntime.js';
import type { IAgentContextSessionManager } from '../../../../src/agent/context/interfaces/IAgentContextSessionManager.js';
import type { IAgentToolPipeline } from '../../../../src/agent/protocol/interfaces/IAgentToolPipeline.js';
import type { ITaskExecutionCoordinator } from '../../../../src/agent/runtime/interfaces/ITaskExecutionCoordinator.js';
import type { ITaskVerificationCoordinator } from '../../../../src/agent/runtime/interfaces/ITaskVerificationCoordinator.js';
import type { IObservationProcessor } from '../../../../src/agent/observation/interfaces/IObservationProcessor.js';
import type { IVerificationProcessor } from '../../../../src/verification/interfaces/IVerificationProcessor.js';
import type { Agent } from '../../../../src/agent/models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../../../../src/agent/models/AgentSession.js';
import type { AgentTask } from '../../../../src/agent/context/models/AgentTask.js';
import type { ToolRequest } from '../../../../src/agent/protocol/models/ToolRequest.js';
import type { ToolResponse } from '../../../../src/agent/protocol/models/ToolResponse.js';
import type { TaskStartResult } from '../../../../src/agent/runtime/models/TaskStartResult.js';
import type { TaskExecutionReportParams, TaskExecutionReportResult, ScopeValidationParams } from '../../../../src/agent/runtime/interfaces/ITaskExecutionCoordinator.js';
import type { TaskVerificationReportParams, TaskVerificationReportResult } from '../../../../src/agent/runtime/interfaces/ITaskVerificationCoordinator.js';
import type { TaskVerificationState } from '../../../../src/agent/runtime/models/TaskVerificationState.js';
import { AgentCapabilitySet } from '../../../../src/agent/models/AgentCapabilitySet.js';
import { createProductionAgentRuntime } from '../../../../src/agent/runtime/di/AgentRuntimeDISetup.js';
import type { ProductionAgentRuntime } from '../../../../src/agent/runtime/core/ProductionAgentRuntime.js';
import type { AgentRuntimeConfig } from '../../../../src/agent/runtime/models/AgentRuntimeConfig.js';

import { createMockContextPackage } from '../../context/ContextTestHelper.js';
import type { GetCurrentContextResult } from '../../../../src/agent/context/interfaces/IAgentContextSessionManager.js';
import type { RefreshContextResult } from '../../../../src/agent/context/interfaces/IAgentContextRefresher.js';
import type { TaskExecutionState } from '../../../../src/agent/runtime/models/TaskExecutionState.js';

export class SimpleEventBus implements IEventBus {
  public publishedEvents: Array<{ eventName: string; payload: unknown }> = [];

  public publish<T>(eventName: string, payload: T): void {
    this.publishedEvents.push({ eventName, payload });
  }

  public subscribe<T>(_eventName: string, _handler: (event: any) => void): void {}
  public unsubscribe<T>(_eventName: string, _handler: (event: any) => void): void {}
}

export function createMockAgent(agentId: string = 'test-agent'): Agent {
  const now = new Date().toISOString();
  return {
    agentId,
    name: 'Test Coding Agent',
    type: 'CLI_AGENT',
    version: '1.0.0',
    capabilities: new AgentCapabilitySet(['TASK_CONTEXT', 'EXECUTION_REPORT']),
    trustLevel: 'TRUSTED',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    metadata: {},
  };
}

export function createTestProductionRuntime(options?: {
  readonly config?: Partial<AgentRuntimeConfig> | undefined;
  readonly toolLatencyMs?: number | undefined;
  readonly toolSuccess?: boolean | undefined;
  readonly verificationState?: 'PASSED' | 'FAILED' | 'NOT_STARTED' | undefined;
}): {
  readonly runtime: ProductionAgentRuntime;
  readonly eventBus: SimpleEventBus;
  readonly sessionManager: IAgentSessionManager;
  readonly taskRuntime: ITaskRuntime;
  readonly contextSessionManager: IAgentContextSessionManager;
  readonly toolPipeline: IAgentToolPipeline;
  readonly executionCoordinator: ITaskExecutionCoordinator;
  readonly verificationCoordinator: ITaskVerificationCoordinator;
  readonly observationProcessor: IObservationProcessor;
  readonly verificationProcessor: IVerificationProcessor;
} {
  const eventBus = new SimpleEventBus();
  const sessions = new Map<string, AgentSession>();
  const tasks = new Map<string, AgentTask>();

  const sessionManager: IAgentSessionManager = {
    createSession: async (params: AgentSessionCreateParams, agent: Agent): Promise<AgentSession> => {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const session: AgentSession = {
        sessionId,
        agentId: agent.agentId,
        workspaceId: params.workspaceId,
        repositoryId: params.repositoryId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        capabilities: agent.capabilities,
        protocolVersion: '1.0.0',
        metadata: params.metadata,
      };
      sessions.set(sessionId, session);
      return session;
    },
    getSession: async (sessionId: string) => sessions.get(sessionId),
    touchSession: async (sessionId: string) => {
      const s = sessions.get(sessionId)!;
      return s;
    },
    closeSession: async (sessionId: string) => {
      const s = sessions.get(sessionId);
      if (s) {
        sessions.set(sessionId, { ...s, status: 'TERMINATED' });
        return true;
      }
      return false;
    },
    listSessionsForAgent: async (agentId: string) =>
      Array.from(sessions.values()).filter((s) => s.agentId === agentId),
    validateSessionScope: () => {},
  };

  const taskRuntime: ITaskRuntime = {
    startTask: async (params, scope) => {
      const taskId = params.taskId ?? `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const task: AgentTask = {
        taskId,
        contextSessionId: params.contextSessionId ?? 'ctx_1',
        agentSessionId: scope.agentSessionId,
        workspaceId: scope.workspaceId,
        repositoryId: scope.repositoryId,
        title: params.title ?? 'Test Task',
        description: params.description ?? 'Test Description',
        intent: params.intent ?? 'Test Intent',
        status: 'READY',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };
      tasks.set(taskId, task);
      const startResult: TaskStartResult = {
        task,
        contextSession: {
          contextSessionId: params.contextSessionId ?? 'ctx_1',
          agentSessionId: scope.agentSessionId,
          workspaceId: scope.workspaceId,
          repositoryId: scope.repositoryId,
          taskId,
          taskText: params.title ?? 'Test Task',
          taskIntent: params.intent ?? 'Test Intent',
          status: 'ACTIVE',
          currentContextVersion: 1,
          currentKnowledgeVersion: '1.0.0',
          currentContextPackageId: 'pkg_test_1',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastContextRefreshAt: new Date(),
          metadata: {},
        },
        contextPackage: createMockContextPackage(),
        state: 'READY',
        freshness: 'CURRENT',
        contextVersion: 1,
        warnings: [],
      };
      return startResult;
    },
    getTask: async (taskId) => tasks.get(taskId),
    listTasks: async () => Array.from(tasks.values()),
    updateTask: async (params) => {
      const t = tasks.get(params.taskId)!;
      tasks.set(params.taskId, { ...t, updatedAt: new Date() });
      return tasks.get(params.taskId)!;
    },
    getTaskRuntimeState: async (taskId) => ({} as any),
    getTaskProgress: async (taskId) => ({} as any),
    getTaskSummary: async (taskId) => ({} as any),
    reportExecution: async () => ({} as any),
    reportVerification: async () => ({} as any),
    completeTask: async (params) => {
      const t = tasks.get(params.taskId)!;
      const completed: AgentTask = { ...t, status: 'COMPLETED', completedAt: new Date() };
      tasks.set(params.taskId, completed);
      return completed;
    },
    resumeTask: async (params) => {
      const t = tasks.get(params.taskId)!;
      const resumed: AgentTask = { ...t, status: 'READY' };
      tasks.set(params.taskId, resumed);
      return resumed;
    },
    cancelTask: async (params) => {
      const t = tasks.get(params.taskId)!;
      const cancelled: AgentTask = { ...t, status: 'CANCELLED' };
      tasks.set(params.taskId, cancelled);
      return cancelled;
    },
    recoverTask: async () => ({} as any),
    reconnectSession: async () => ({} as any),
  };

  const contextSessionManager: IAgentContextSessionManager = {
    startTaskContext: async () => ({} as any),
    createContextSession: async () => ({} as any),
    getContextSession: async () => ({} as any),
    getTask: async () => ({} as any),
    getTaskForContextSession: async () => ({} as any),
    updateContextSession: async () => ({} as any),
    pauseContextSession: async () => ({} as any),
    resumeContextSession: async () => ({} as any),
    completeContextSession: async () => ({} as any),
    cancelContextSession: async () => ({} as any),
    markContextStale: async () => {},
    getCurrentContext: async (contextSessionId, options) => ({
      contextSession: {
        contextSessionId,
        agentSessionId: 'sess_1',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
        taskId: 'task_1',
        taskText: 'Test Task',
        taskIntent: 'Test Intent',
        status: 'ACTIVE',
        currentContextVersion: 1,
        currentKnowledgeVersion: '1.0.0',
        currentContextPackageId: 'pkg_test_1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastContextRefreshAt: new Date(),
        metadata: {},
      },
      contextPackage: createMockContextPackage(),
      contextVersion: 1,
      freshness: 'CURRENT',
      wasRefreshed: options?.autoRefreshIfStale ?? false,
      warnings: [],
    }),
    refreshContextSession: async (contextSessionId) => ({
      package: createMockContextPackage(),
      refreshedVersion: 2,
      previousVersion: 1,
      reason: 'EXPLICIT_REQUEST',
      reusedSections: [],
      rebuiltSections: [],
      affectedFeatures: [],
      durationMs: 10,
    }),
    updateTaskContext: async () => ({} as any),
    reportExecution: async () => ({} as any),
    pinContext: async () => ({} as any),
    unpinContext: async () => true,
    listPinnedContext: async () => [],
    recordFeedback: async () => ({} as any),
    getContextState: async () => ({} as any),
  };

  const toolPipeline: IAgentToolPipeline = {
    execute: async (request: ToolRequest): Promise<ToolResponse> => {
      if (options?.toolLatencyMs) {
        await new Promise((resolve) => setTimeout(resolve, options.toolLatencyMs));
      }
      const success = options?.toolSuccess ?? true;
      return {
        requestId: request.requestId,
        toolName: request.toolName,
        success,
        result: success ? { answer: 'sample result' } : undefined,
        warnings: [],
        error: success ? undefined : { code: 'TOOL_ERROR', message: 'Tool execution failed', retryable: false },
        metadata: {
          durationMs: options?.toolLatencyMs ?? 5,
          timestamp: new Date().toISOString(),
          protocolVersion: '1.0.0',
        },
        protocolVersion: '1.0.0',
        timestamp: new Date().toISOString(),
      };
    },
    registerHandler: () => {},
    getRegistry: () => ({} as any),
  };

  const executionCoordinator: ITaskExecutionCoordinator = {
    reportExecution: async (params: TaskExecutionReportParams): Promise<TaskExecutionReportResult> => ({
      taskId: params.taskId,
      reportId: `rep_${Date.now()}`,
      acknowledged: true,
      executionState: {
        executionState: 'IN_PROGRESS',
        lastReportId: 'rep_1',
        updatedAt: new Date(),
        operationHistory: params.operations ?? [],
        evidenceLevel: (params.metadata?.evidenceLevel as string | undefined) ?? 'AGENT_REPORTED',
      },
      recordedAt: new Date().toISOString(),
    }),
    getExecutionState: async (taskId: string): Promise<TaskExecutionState> => ({
      executionState: 'IN_PROGRESS',
      lastReportId: 'rep_1',
      updatedAt: new Date(),
      operationHistory: [],
      evidenceLevel: 'AGENT_REPORTED',
    }),
  };

  let vStatus: 'PASSED' | 'FAILED' | 'NOT_STARTED' = options?.verificationState ?? 'PASSED';
  const verificationCoordinator: ITaskVerificationCoordinator = {
    reportVerification: async (params: TaskVerificationReportParams): Promise<TaskVerificationReportResult> => {
      vStatus = params.passed ? 'PASSED' : 'FAILED';
      return {
        taskId: params.taskId,
        reportId: `vrep_${Date.now()}`,
        recorded: true,
        status: vStatus,
        verificationState: {
          verificationState: vStatus,
          verificationSource: 'SYSTEM_VERIFIED',
          diagnostics: [],
          updatedAt: new Date(),
          operationHistory: [],
        },
        recordedAt: new Date().toISOString(),
      };
    },
    getVerificationState: async () => ({
      verificationState: vStatus,
      verificationSource: 'SYSTEM_VERIFIED',
      diagnostics: [],
      updatedAt: new Date(),
      operationHistory: [],
    }),
  };

  const observationProcessor: IObservationProcessor = {
    processRawObservation: async () => ({} as any),
    process: async () => ({} as any),
    processExecutionReport: async () => ({} as any),
    processVerificationReport: async () => ({} as any),
  };

  const verificationProcessor: IVerificationProcessor = {
    processVerification: async () => ({} as any),
  };

  const runtime = createProductionAgentRuntime({
    sessionManager,
    taskRuntime,
    contextSessionManager,
    toolPipeline,
    executionCoordinator,
    verificationCoordinator,
    observationProcessor,
    verificationProcessor,
    eventBus,
    config: options?.config,
  });

  return {
    runtime,
    eventBus,
    sessionManager,
    taskRuntime,
    contextSessionManager,
    toolPipeline,
    executionCoordinator,
    verificationCoordinator,
    observationProcessor,
    verificationProcessor,
  };
}
