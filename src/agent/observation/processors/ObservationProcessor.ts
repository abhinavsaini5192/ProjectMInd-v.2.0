import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';
import type {
  IObservationProcessor,
  ProcessExecutionReportParams,
  ProcessVerificationReportParams,
  ObservationProcessingResult,
  BatchObservationProcessingResult,
} from '../interfaces/IObservationProcessor.js';
import type { RawObservationInput, IObservationNormalizer } from '../interfaces/IObservationNormalizer.js';
import type { IObservationValidator, ScopeValidationParams } from '../interfaces/IObservationValidator.js';
import type { IObservationClassifier } from '../interfaces/IObservationClassifier.js';
import type { IObservationCorrelator } from '../interfaces/IObservationCorrelator.js';
import type { IObservationStore } from '../interfaces/IObservationStore.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { ITaskRuntime } from '../../runtime/interfaces/ITaskRuntime.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import { ObservationEvents } from '../events/ObservationEvents.js';
import { ObservationNormalizer } from '../normalizers/ObservationNormalizer.js';
import { ObservationValidator } from '../validators/ObservationValidator.js';
import { ObservationClassifier } from '../classifiers/ObservationClassifier.js';
import { ObservationCorrelator } from '../correlators/ObservationCorrelator.js';

export interface ObservationProcessorDependencies {
  readonly store: IObservationStore;
  readonly normalizer?: IObservationNormalizer | undefined;
  readonly validator?: IObservationValidator | undefined;
  readonly classifier?: IObservationClassifier | undefined;
  readonly correlator?: IObservationCorrelator | undefined;
  readonly eventBus?: IEventBus | undefined;
  readonly taskRuntime?: ITaskRuntime | undefined;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  readonly featureKnowledgeAPI?: IFeatureKnowledgeAPI | undefined;
}

export class ObservationProcessor implements IObservationProcessor {
  private readonly store: IObservationStore;
  private readonly normalizer: IObservationNormalizer;
  private readonly validator: IObservationValidator;
  private readonly classifier: IObservationClassifier;
  private readonly correlator: IObservationCorrelator;
  private readonly eventBus?: IEventBus | undefined;
  private readonly taskRuntime?: ITaskRuntime | undefined;
  private readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  private readonly featureKnowledgeAPI?: IFeatureKnowledgeAPI | undefined;

  constructor(deps: ObservationProcessorDependencies) {
    this.store = deps.store;
    this.normalizer = deps.normalizer ?? new ObservationNormalizer();
    this.validator = deps.validator ?? new ObservationValidator();
    this.classifier = deps.classifier ?? new ObservationClassifier();
    this.correlator = deps.correlator ?? new ObservationCorrelator();
    this.eventBus = deps.eventBus;
    this.taskRuntime = deps.taskRuntime;
    this.contextSessionManager = deps.contextSessionManager;
    this.featureKnowledgeAPI = deps.featureKnowledgeAPI;
  }

  public readonly process = this.processRawObservation.bind(this);

  public async processRawObservation(
    input: RawObservationInput,
    scope?: ScopeValidationParams
  ): Promise<ObservationProcessingResult> {
    // 1. Deduplication check
    const dedupKey =
      input.operationId ??
      `${input.taskId ?? 'global'}_${input.type ?? 'unknown'}_${input.sequenceNumber !== undefined ? input.sequenceNumber : ''}_${input.summary ?? ''}_${input.timestamp ? new Date(input.timestamp).toISOString() : ''}_${JSON.stringify(input.payload ?? {})}`;

    if (await this.store.hasProcessedOperation(dedupKey)) {
      const existing = await this.store.getObservationByOperationId(dedupKey);
      if (existing) {
        return {
          observation: { ...existing, ordering: 'DUPLICATE', orderingStatus: 'DUPLICATE' },
          processed: true,
          isDuplicate: true,
          conflicts: [],
        };
      }
    }

    // 2. Normalize
    const normalized = this.normalizer.normalize(input, scope);

    // 3. Classify
    const classification = this.classifier.classify(normalized);

    // 4. Correlate with existing observations
    const existing = normalized.taskId
      ? await this.store.listObservations({
          workspaceId: normalized.workspaceId,
          repositoryId: normalized.repositoryId,
          taskId: normalized.taskId,
          limit: 500,
        })
      : [];

    const correlation = await this.correlator.correlate(normalized, existing);

    // 5. Persist conflicts
    for (const conflict of correlation.detectedConflicts) {
      await this.store.saveConflict(conflict);
      if (this.eventBus) {
        const payload = {
          conflictId: conflict.conflictId,
          taskId: conflict.taskId,
          field: conflict.field,
          sources: conflict.sources,
          severity: conflict.severity,
          timestamp: new Date().toISOString(),
          conflict,
        };
        this.eventBus.publish(ObservationEvents.OBSERVATION_CONFLICT_DETECTED, payload);
        this.eventBus.publish(ObservationEvents.CONFLICT_DETECTED, payload);
      }
    }

    // 6. Persist observation
    const finalObservation: ExecutionObservation = {
      ...correlation.observation,
      category: classification.category,
      affectedResources: classification.affectedResources,
      targetTaskState: classification.affectedTaskState,
      status: 'PROCESSED',
    };
    await this.store.saveObservation(finalObservation);

    await this.store.recordProcessedOperation(dedupKey, finalObservation.observationId);
    if (input.operationId && input.operationId !== dedupKey) {
      await this.store.recordProcessedOperation(input.operationId, finalObservation.observationId);
    }

    // 7. Emit events
    if (this.eventBus) {
      this.eventBus.publish(ObservationEvents.OBSERVATION_PROCESSED, {
        observationId: finalObservation.observationId,
        taskId: finalObservation.taskId,
        workspaceId: finalObservation.workspaceId,
        repositoryId: finalObservation.repositoryId,
        agentSessionId: finalObservation.agentSessionId,
        type: finalObservation.type,
        source: finalObservation.source,
        timestamp: finalObservation.timestamp,
        observation: finalObservation,
      });

      if (finalObservation.affectedResources && finalObservation.affectedResources.length > 0) {
        this.eventBus.publish(ObservationEvents.RESOURCES_CHANGED, {
          observationId: finalObservation.observationId,
          taskId: finalObservation.taskId,
          workspaceId: finalObservation.workspaceId,
          repositoryId: finalObservation.repositoryId,
          affectedResources: finalObservation.affectedResources,
          timestamp: finalObservation.timestamp,
        });
      }
    }

    // 8. Record timeline entry
    if (finalObservation.taskId) {
      await this.store.recordTimelineEntry(finalObservation.taskId, {
        entryId: `entry_${finalObservation.observationId}`,
        observationId: finalObservation.observationId,
        timestamp: finalObservation.timestamp,
        type: finalObservation.type,
        summary: this.getSummaryFromObservation(finalObservation),
        provenance: finalObservation.provenance,
        causality: finalObservation.correlationId || finalObservation.parentObservationId ? 'EXPLICIT' : 'SEQUENTIAL',
        affectedResources: classification.affectedResources,
        operationId: finalObservation.operationId,
        parentObservationId: finalObservation.parentObservationId,
      });
    }

    // 9. Downstream Task State integration
    if (this.taskRuntime && finalObservation.taskId) {
      if (
        finalObservation.type === 'AGENT_BLOCKER' ||
        finalObservation.type === 'TASK_BLOCKED' ||
        finalObservation.type === 'BLOCKER_ENCOUNTERED'
      ) {
        const payload = (finalObservation.payload as Record<string, unknown>) ?? {};
        const reason = String(
          payload['description'] ?? payload['reason'] ?? finalObservation.summary ?? 'Blocker encountered'
        );
        try {
          if (typeof (this.taskRuntime as any).updateTaskStatus === 'function') {
            await (this.taskRuntime as any).updateTaskStatus(finalObservation.taskId, 'BLOCKED', reason);
          } else {
            await this.taskRuntime.updateTask(
              {
                taskId: finalObservation.taskId,
                metadata: { blockedReason: reason },
              },
              {
                workspaceId: finalObservation.workspaceId,
                repositoryId: finalObservation.repositoryId,
                agentSessionId: finalObservation.agentSessionId ?? 'default',
              }
            );
          }
        } catch {
          // ignore if task transition fails
        }
      }
    }

    return {
      observation: finalObservation,
      processed: true,
      isDuplicate: false,
      conflicts: correlation.detectedConflicts,
    };
  }

  public async processExecutionReport(
    params: ProcessExecutionReportParams,
    scope?: ScopeValidationParams | string
  ): Promise<BatchObservationProcessingResult> {
    let workspaceId = 'default-workspace';
    let repositoryId = 'default-repo';
    let agentSessionId: string | undefined;

    if (typeof scope === 'string') {
      agentSessionId = scope;
    } else if (scope && typeof scope === 'object') {
      workspaceId = scope.workspaceId || 'default-workspace';
      repositoryId = scope.repositoryId || 'default-repo';
      agentSessionId = scope.agentSessionId;
    }

    const scopeObj: ScopeValidationParams = {
      workspaceId,
      repositoryId,
      agentSessionId,
      taskId: params.taskId,
    };

    // Deduplication check
    if (params.operationId && (await this.store.hasProcessedOperation(params.operationId))) {
      const existing = await this.store.getObservationByOperationId(params.operationId);
      const conflicts = await this.store.listConflicts(params.taskId);
      return {
        observations: existing ? [existing] : [],
        conflicts,
        invalidationDecision: 'NO_REFRESH_REQUIRED',
      };
    }

    const observations: ExecutionObservation[] = [];
    const allConflicts: ObservationConflict[] = [];

    // Process unified execution observation
    const modified = params.modifiedFiles ?? [];
    const added = params.addedFiles ?? [];
    const deleted = params.deletedFiles ?? [];
    const allAffected = Array.from(new Set([...modified, ...added, ...deleted]));

    const res = await this.processRawObservation(
      {
        taskId: params.taskId,
        contextSessionId: params.contextSessionId,
        agentSessionId,
        workspaceId,
        repositoryId,
        source: 'AGENT',
        type: 'FILE_MODIFICATION',
        summary: params.summary,
        affectedResources: allAffected,
        payload: {
          modifiedFiles: modified,
          addedFiles: added,
          deletedFiles: deleted,
          status: params.status,
          summary: params.summary,
          command: params.commandText,
        },
        operationId: params.operationId,
        metadata: params.metadata,
      },
      scopeObj
    );
    observations.push(res.observation);
    allConflicts.push(...res.conflicts);

    // 4. Update TaskRuntime if available
    let invalidationDecision: string | undefined;
    if (this.taskRuntime) {
      try {
        if (typeof (this.taskRuntime as any).reportExecution === 'function') {
          const runtimeResult = await (this.taskRuntime as any).reportExecution(
            {
              taskId: params.taskId,
              contextSessionId: params.contextSessionId,
              status: params.status as any,
              summary: params.summary,
              modifiedFiles: [...modified, ...added],
              operationId: params.operationId,
              metadata: params.metadata,
            },
            scopeObj
          );
          invalidationDecision = runtimeResult?.invalidationDecision;
        } else if (typeof (this.taskRuntime as any).updateExecution === 'function') {
          await (this.taskRuntime as any).updateExecution(params.taskId, {
            status: params.status,
            summary: params.summary,
            modifiedFiles: [...modified, ...added],
          });
        }
      } catch {
        // Task runtime handled gracefully
      }
    }

    // 5. Invalidate context session if modified files
    if (this.contextSessionManager) {
      const targetSessionId = params.contextSessionId ?? agentSessionId;
      if (targetSessionId && (modified.length > 0 || added.length > 0)) {
        try {
          if (typeof (this.contextSessionManager as any).invalidateSession === 'function') {
            await (this.contextSessionManager as any).invalidateSession(
              targetSessionId,
              `Modified files reported in task ${params.taskId}`,
              [...modified, ...added]
            );
          }
          if (typeof (this.contextSessionManager as any).markContextStale === 'function') {
            await this.contextSessionManager.markContextStale(
              targetSessionId,
              'RESOURCE_CHANGED',
              {
                workspaceId,
                repositoryId,
                agentSessionId: agentSessionId ?? 'default',
              }
            );
          }
          invalidationDecision = invalidationDecision ?? 'INVALIDATED';
        } catch {
          // Context session manager handled gracefully
        }
      }
    }

    // 6. If operationId is provided, register master operation deduplication
    if (params.operationId && observations.length > 0) {
      await this.store.recordProcessedOperation(params.operationId, observations[0]!.observationId);
    }

    return {
      observations,
      observation: observations[0],
      conflicts: allConflicts,
      conflictDetected: allConflicts.length > 0,
      conflict: allConflicts[0],
      invalidationDecision,
    };
  }

  public async processVerificationReport(
    params: ProcessVerificationReportParams,
    scope?: ScopeValidationParams | string
  ): Promise<BatchObservationProcessingResult> {
    let workspaceId = 'default-workspace';
    let repositoryId = 'default-repo';
    let agentSessionId: string | undefined;
    let source: 'AGENT' | 'VERIFICATION' = params.source ?? 'AGENT';

    if (typeof scope === 'string') {
      if (scope === 'AGENT' || scope === 'VERIFICATION') {
        source = scope;
      } else {
        agentSessionId = scope;
      }
    } else if (scope && typeof scope === 'object') {
      workspaceId = scope.workspaceId || 'default-workspace';
      repositoryId = scope.repositoryId || 'default-repo';
      agentSessionId = scope.agentSessionId;
      if (params.source) source = params.source;
    }

    const scopeObj: ScopeValidationParams = {
      workspaceId,
      repositoryId,
      agentSessionId,
      taskId: params.taskId,
    };

    // Deduplication check
    if (params.operationId && (await this.store.hasProcessedOperation(params.operationId))) {
      const existing = await this.store.getObservationByOperationId(params.operationId);
      const conflicts = await this.store.listConflicts(params.taskId);
      return {
        observations: existing ? [existing] : [],
        conflicts,
      };
    }

    const observations: ExecutionObservation[] = [];
    const allConflicts: ObservationConflict[] = [];

    // Verification observation
    const verifType = params.passed ? 'VERIFICATION_PASSED' : 'VERIFICATION_FAILED';
    const verifResult = await this.processRawObservation(
      {
        taskId: params.taskId,
        agentSessionId,
        workspaceId,
        repositoryId,
        source,
        type: verifType,
        summary: params.summary,
        payload: {
          passed: params.passed,
          summary: params.summary,
          testResults: params.testResults,
          diagnostics: params.diagnostics,
          buildPassed: params.buildPassed,
        },
        operationId: params.operationId,
        metadata: params.metadata,
      },
      scopeObj
    );
    observations.push(verifResult.observation);
    allConflicts.push(...verifResult.conflicts);

    // 4. Update TaskRuntime if available
    if (this.taskRuntime) {
      try {
        if (typeof (this.taskRuntime as any).reportVerification === 'function') {
          await (this.taskRuntime as any).reportVerification(
            {
              taskId: params.taskId,
              passed: params.passed,
              summary: params.summary,
              testResults: params.testResults,
              diagnostics: params.diagnostics,
              operationId: params.operationId,
            },
            scopeObj
          );
        } else if (typeof (this.taskRuntime as any).updateVerification === 'function') {
          await (this.taskRuntime as any).updateVerification(params.taskId, {
            passed: params.passed,
            summary: params.summary,
            testResults: params.testResults,
          });
        }
      } catch {
        // Fallback gracefully
      }
    }

    // 5. Register master operationId
    if (params.operationId && observations.length > 0) {
      await this.store.recordProcessedOperation(params.operationId, observations[0]!.observationId);
    }

    const primaryObservation = observations.find((o) => o.type === verifType) ?? observations[observations.length - 1];
    const conflictDetected = allConflicts.length > 0;
    const conflict = conflictDetected ? allConflicts[0] : undefined;

    return {
      observations,
      observation: primaryObservation,
      conflicts: allConflicts,
      conflictDetected,
      conflict,
    };
  }

  private getSummaryFromObservation(obs: ExecutionObservation): string {
    const payload = obs.payload as Record<string, unknown>;
    if (typeof payload['summary'] === 'string') return payload['summary'];
    if (typeof payload['description'] === 'string') return payload['description'];
    if (typeof payload['path'] === 'string') return `${obs.type}: ${payload['path']}`;
    if (typeof payload['command'] === 'string') return `Command: ${payload['command']}`;
    return `${obs.type} from ${obs.source}`;
  }
}
