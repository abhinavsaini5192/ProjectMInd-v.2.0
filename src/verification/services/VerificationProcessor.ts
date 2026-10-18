import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type {
  IVerificationProcessor,
  VerificationProcessingResult,
} from '../interfaces/IVerificationProcessor.js';
import type { RawVerificationInput, IVerificationNormalizer } from '../interfaces/IVerificationNormalizer.js';
import type { IVerificationValidator, VerificationScopeContext } from '../interfaces/IVerificationValidator.js';
import type { IVerificationCorrelator } from '../interfaces/IVerificationCorrelator.js';
import type { IVerificationConflictResolver } from '../interfaces/IVerificationConflictResolver.js';
import type { IVerificationFreshnessEvaluator } from '../interfaces/IVerificationFreshnessEvaluator.js';
import type { IVerificationStore } from '../interfaces/IVerificationStore.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import type { ITaskRuntime } from '../..//agent/runtime/interfaces/ITaskRuntime.js';
import type { IObservationProcessor } from '../../agent/observation/interfaces/IObservationProcessor.js';
import type { IAgentContextSessionManager } from '../../agent/context/interfaces/IAgentContextSessionManager.js';
import { VerificationNormalizer } from './VerificationNormalizer.js';
import { VerificationValidator } from './VerificationValidator.js';
import { VerificationCorrelator } from './VerificationCorrelator.js';
import { VerificationConflictResolver } from './VerificationConflictResolver.js';
import { VerificationFreshnessEvaluator } from './VerificationFreshnessEvaluator.js';
import { VerificationEvents } from '../events/VerificationEvents.js';
import { isTrustedVerification } from '../models/VerificationProvenance.js';

export interface VerificationProcessorDependencies {
  readonly store: IVerificationStore;
  readonly normalizer?: IVerificationNormalizer | undefined;
  readonly validator?: IVerificationValidator | undefined;
  readonly correlator?: IVerificationCorrelator | undefined;
  readonly conflictResolver?: IVerificationConflictResolver | undefined;
  readonly freshnessEvaluator?: IVerificationFreshnessEvaluator | undefined;
  readonly eventBus?: IEventBus | undefined;
  readonly taskRuntime?: ITaskRuntime | undefined;
  readonly observationProcessor?: IObservationProcessor | undefined;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
}

export class VerificationProcessor implements IVerificationProcessor {
  private readonly store: IVerificationStore;
  private readonly normalizer: IVerificationNormalizer;
  private readonly validator: IVerificationValidator;
  private readonly correlator: IVerificationCorrelator;
  private readonly conflictResolver: IVerificationConflictResolver;
  private readonly freshnessEvaluator: IVerificationFreshnessEvaluator;
  private readonly eventBus?: IEventBus | undefined;
  private readonly taskRuntime?: ITaskRuntime | undefined;
  private readonly observationProcessor?: IObservationProcessor | undefined;
  private readonly contextSessionManager?: IAgentContextSessionManager | undefined;

  constructor(deps: VerificationProcessorDependencies) {
    this.store = deps.store;
    this.normalizer = deps.normalizer ?? new VerificationNormalizer();
    this.validator = deps.validator ?? new VerificationValidator();
    this.correlator = deps.correlator ?? new VerificationCorrelator();
    this.conflictResolver = deps.conflictResolver ?? new VerificationConflictResolver();
    this.freshnessEvaluator = deps.freshnessEvaluator ?? new VerificationFreshnessEvaluator();
    this.eventBus = deps.eventBus;
    this.taskRuntime = deps.taskRuntime;
    this.observationProcessor = deps.observationProcessor;
    this.contextSessionManager = deps.contextSessionManager;
  }

  public async processVerification(
    input: RawVerificationInput,
    scopeContext?: VerificationScopeContext | undefined
  ): Promise<VerificationProcessingResult> {
    // 1. Deduplication by operationId or verificationId
    if (input.operationId && (await this.store.hasProcessedOperation(input.operationId))) {
      const existing = await this.store.getVerificationByOperationId(input.operationId);
      if (existing) {
        const freshness = this.freshnessEvaluator.evaluateFreshness(existing);
        const conflicts = await this.store.listConflicts(existing.taskId);
        return {
          record: existing,
          processed: true,
          isDuplicate: true,
          conflicts,
          freshness,
        };
      }
    }

    if (input.verificationId) {
      const existing = await this.store.getVerification(input.verificationId);
      if (existing) {
        const freshness = this.freshnessEvaluator.evaluateFreshness(existing);
        const conflicts = await this.store.listConflicts(existing.taskId);
        return {
          record: existing,
          processed: true,
          isDuplicate: true,
          conflicts,
          freshness,
        };
      }
    }

    // 2. Normalization
    const normalized = this.normalizer.normalize(input, scopeContext);

    // 3. Validation
    await this.validator.validate(normalized, scopeContext);

    // 4. Correlation
    const existingForTask = normalized.taskId
      ? await this.store.listVerifications({
          taskId: normalized.taskId,
          workspaceId: normalized.workspaceId,
          repositoryId: normalized.repositoryId,
          limit: 100,
        })
      : [];

    const correlationResult = await this.correlator.correlate(normalized, existingForTask);
    const correlatedRecord = correlationResult.correlatedRecord;

    // 5. Conflict Detection
    const conflictResult = this.conflictResolver.detectConflicts(
      correlatedRecord,
      existingForTask
    );

    for (const conflict of conflictResult.detectedConflicts) {
      await this.store.saveConflict(conflict);
      if (this.eventBus) {
        this.eventBus.publish(VerificationEvents.VERIFICATION_CONFLICT_DETECTED, {
          conflictId: conflict.conflictId,
          taskId: conflict.taskId,
          conflict,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 6. Freshness Evaluation
    const freshness = this.freshnessEvaluator.evaluateFreshness(correlatedRecord);

    // 7. Persist Verification Record
    await this.store.saveVerification(correlatedRecord);

    if (input.operationId) {
      await this.store.recordProcessedOperation(input.operationId, correlatedRecord.verificationId);
    }

    // 8. Record Timeline Entry
    if (correlatedRecord.taskId) {
      await this.store.recordTimelineEntry(correlatedRecord.taskId, {
        entryId: `tle_${correlatedRecord.verificationId}`,
        verificationId: correlatedRecord.verificationId,
        timestamp: correlatedRecord.completedAt ?? correlatedRecord.receivedAt,
        verificationType: correlatedRecord.verificationType,
        status: correlatedRecord.status,
        source: correlatedRecord.source,
        provenance: correlatedRecord.provenance,
        summary: correlatedRecord.summary,
        repositoryState: correlatedRecord.repositoryState,
        causality: correlatedRecord.correlationId ? 'EXPLICIT' : 'SEQUENTIAL',
        affectedResources: correlatedRecord.scope.targetFiles,
        correlationId: correlatedRecord.correlationId,
        operationId: correlatedRecord.operationId,
      });
    }

    // 9. Publish Lifecycle Events
    if (this.eventBus) {
      this.eventBus.publish(VerificationEvents.VERIFICATION_RECEIVED, {
        verificationId: correlatedRecord.verificationId,
        taskId: correlatedRecord.taskId,
        workspaceId: correlatedRecord.workspaceId,
        repositoryId: correlatedRecord.repositoryId,
        source: correlatedRecord.source,
        timestamp: correlatedRecord.receivedAt,
      });

      this.eventBus.publish(VerificationEvents.VERIFICATION_VALIDATED, {
        verificationId: correlatedRecord.verificationId,
        isValid: true,
        timestamp: new Date().toISOString(),
      });

      if (correlatedRecord.status === 'PASSED') {
        this.eventBus.publish(VerificationEvents.VERIFICATION_COMPLETED, {
          verificationId: correlatedRecord.verificationId,
          taskId: correlatedRecord.taskId,
          verificationType: correlatedRecord.verificationType,
          status: correlatedRecord.status,
          isTrusted: isTrustedVerification(correlatedRecord.provenance),
          timestamp: new Date().toISOString(),
          record: correlatedRecord,
        });
      } else if (correlatedRecord.status === 'FAILED') {
        this.eventBus.publish(VerificationEvents.VERIFICATION_FAILED, {
          verificationId: correlatedRecord.verificationId,
          taskId: correlatedRecord.taskId,
          verificationType: correlatedRecord.verificationType,
          failureSummary: correlatedRecord.summary,
          diagnostics: correlatedRecord.diagnostics,
          timestamp: new Date().toISOString(),
          record: correlatedRecord,
        });
      }
    }

    // 10. Downstream Integration with TaskRuntime
    if (this.taskRuntime && correlatedRecord.taskId) {
      try {
        if (typeof (this.taskRuntime as any).reportVerification === 'function') {
          await (this.taskRuntime as any).reportVerification(
            {
              taskId: correlatedRecord.taskId,
              passed: correlatedRecord.status === 'PASSED',
              summary: correlatedRecord.summary,
              diagnostics: correlatedRecord.diagnostics,
              operationId: correlatedRecord.operationId,
            },
            {
              workspaceId: correlatedRecord.workspaceId,
              repositoryId: correlatedRecord.repositoryId,
              agentSessionId: correlatedRecord.agentSessionId,
            }
          );
        }
      } catch {
        // Handled gracefully
      }
    }

    // 11. Downstream Integration with ObservationProcessor (Phase 7.6 canonical link)
    if (this.observationProcessor && correlatedRecord.taskId) {
      try {
        await this.observationProcessor.processRawObservation({
          taskId: correlatedRecord.taskId,
          contextSessionId: correlatedRecord.contextSessionId,
          agentSessionId: correlatedRecord.agentSessionId,
          workspaceId: correlatedRecord.workspaceId,
          repositoryId: correlatedRecord.repositoryId,
          source: correlatedRecord.source as any,
          type: (correlatedRecord.status === 'PASSED'
            ? 'VERIFICATION_PASSED'
            : 'VERIFICATION_FAILED') as any,
          summary: correlatedRecord.summary,
          affectedResources: correlatedRecord.scope.targetFiles ?? [],
          payload: {
            verificationId: correlatedRecord.verificationId,
            verificationType: correlatedRecord.verificationType,
            status: correlatedRecord.status,
            summary: correlatedRecord.summary,
            diagnostics: correlatedRecord.diagnostics,
            provenance: correlatedRecord.provenance,
          },
          correlationId: correlatedRecord.correlationId,
          operationId: correlatedRecord.operationId,
        });
      } catch {
        // Handled gracefully
      }
    }

    // 12. Downstream Context Invalidation on failure or affected files
    if (this.contextSessionManager && correlatedRecord.contextSessionId) {
      if (correlatedRecord.status === 'FAILED' && correlatedRecord.scope.targetFiles?.length) {
        try {
          await this.contextSessionManager.markContextStale(
            correlatedRecord.contextSessionId,
            'CONTEXT_INVALIDATED'
          );
        } catch {
          // Handled gracefully
        }
      }
    }

    return {
      record: correlatedRecord,
      processed: true,
      isDuplicate: false,
      conflicts: conflictResult.detectedConflicts,
      freshness,
    };
  }
}
