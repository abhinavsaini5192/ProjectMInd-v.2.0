import { randomUUID } from 'crypto';
import type { IKnowledgeUpdateProcessor, IKnowledgeUpdateExecutor } from '../interfaces/IKnowledgeUpdateProcessor.js';
import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { IKnowledgeVersionManager } from '../interfaces/IKnowledgeVersionManager.js';
import type { IKnowledgeInvalidationManager, InvalidationTargetParams } from '../interfaces/IKnowledgeInvalidationManager.js';
import type { IKnowledgeRefreshManager } from '../interfaces/IKnowledgeRefreshManager.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';
import type { KnowledgeUpdateStatus } from '../models/KnowledgeUpdateStatus.js';
import type { KnowledgeUpdateConflict } from '../models/KnowledgeUpdateConflict.js';
import type { KnowledgeInvalidationTargetType } from '../models/KnowledgeInvalidation.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { KNOWLEDGE_UPDATE_EVENTS } from '../events/KnowledgeUpdateEvents.js';

export interface KnowledgeUpdateProcessorDependencies {
  readonly repository: IKnowledgeUpdateRepository;
  readonly executor: IKnowledgeUpdateExecutor;
  readonly versionManager: IKnowledgeVersionManager;
  readonly invalidationManager: IKnowledgeInvalidationManager;
  readonly refreshManager: IKnowledgeRefreshManager;
  readonly eventBus?: IEventBus | undefined;
}

export class KnowledgeUpdateProcessor implements IKnowledgeUpdateProcessor {
  constructor(private readonly deps: KnowledgeUpdateProcessorDependencies) {}

  public async process(
    update: KnowledgeUpdate,
    plan: KnowledgeUpdatePlan
  ): Promise<KnowledgeUpdateResult> {
    // 1. Mark status PROCESSING
    let currentStatus: KnowledgeUpdateStatus = 'PROCESSING';
    await this.deps.repository.saveUpdate({ ...update, status: currentStatus });

    const conflicts: KnowledgeUpdateConflict[] = [];

    // 2. Detect conflicts (e.g. agent report claiming success while verification payload shows failure)
    if (update.source === 'VERIFICATION_EVIDENCE' || (update.metadata && update.metadata.verificationStatus)) {
      const vStatus = update.metadata.verificationStatus as string;
      if (vStatus === 'FAILED' && update.provenance === 'AGENT_REPORTED') {
        const conflict: KnowledgeUpdateConflict = {
          conflictId: randomUUID(),
          updateId: update.updateId,
          conflictType: 'VERIFICATION_CONFLICT',
          conflictingSources: [update.source, 'VERIFICATION_PAYLOAD'],
          evidence: [...update.evidenceReferences],
          affectedKnowledgeAreas: [...update.affectedKnowledgeAreas],
          confidence: update.confidence,
          resolutionStatus: 'RESOLVED_PRECEDENCE',
          resolutionRationale: 'Verification failure takes precedence over agent success assertion.',
          detectedAt: Date.now(),
        };
        await this.deps.repository.saveConflict(conflict);
        conflicts.push(conflict);
      }
    }

    // 3. Execute planned operations
    const execResult = await this.deps.executor.executePlan(update, plan);

    const hasApplied = execResult.appliedAreas.length > 0;
    const hasFailures = execResult.failedAreas.length > 0;

    let success = false;
    let partialSuccess = false;
    let failure = false;

    if (hasApplied && !hasFailures) {
      currentStatus = 'APPLIED';
      success = true;
    } else if (hasApplied && hasFailures) {
      currentStatus = 'PARTIALLY_APPLIED';
      partialSuccess = true;
    } else {
      currentStatus = 'FAILED';
      failure = true;
    }

    const latestVersionBefore = await this.deps.versionManager.getLatestVersion(update.repositoryId);
    let newVersion: string | undefined = latestVersionBefore?.versionId;

    // 4. Versioning & Invalidations if changes applied
    let invalidations: import('../models/KnowledgeInvalidation.js').KnowledgeInvalidation[] = [];
    const refreshDecisions: import('../models/KnowledgeRefreshDecision.js').KnowledgeRefreshDecision[] = [];

    if (hasApplied) {
      const shouldInc = this.deps.versionManager.shouldIncrementVersion(
        execResult.appliedAreas,
        plan.targetResources,
        plan.targetFeatures
      );

      if (shouldInc) {
        const createdVersion = await this.deps.versionManager.createNextVersion({
          repositoryId: update.repositoryId,
          workspaceId: update.workspaceId,
          sourceUpdateIds: [update.updateId],
          affectedAreas: execResult.appliedAreas,
          affectedResources: plan.targetResources,
          affectedFeatures: plan.targetFeatures,
          confidence: update.confidence,
        });
        newVersion = createdVersion.versionId;

        this.deps.eventBus?.publish(KNOWLEDGE_UPDATE_EVENTS.VERSION_CREATED, {
          eventName: KNOWLEDGE_UPDATE_EVENTS.VERSION_CREATED,
          version: createdVersion,
          timestamp: createdVersion.createdAt,
        });
      }

      // Convert invalidation targets
      const targetParams: InvalidationTargetParams[] = plan.invalidationTargets.map((raw) => {
        const [typeStr, idStr] = raw.includes(':') ? raw.split(':') : ['FEATURE_PROFILE', raw];
        return {
          targetType: (typeStr as KnowledgeInvalidationTargetType) || 'FEATURE_PROFILE',
          targetId: idStr || raw,
          reason: `Invalidated by update ${update.updateId} (${update.updateType})`,
        };
      });

      if (targetParams.length > 0) {
        invalidations = await this.deps.invalidationManager.invalidate(
          update.updateId,
          update.repositoryId,
          update.workspaceId,
          targetParams
        );
      }

      // Determine & execute refresh policy
      const refreshDecision = await this.deps.refreshManager.determineRefreshPolicy(
        update,
        plan,
        plan.targetFeatures,
        plan.targetResources
      );
      await this.deps.refreshManager.applyRefreshDecision(refreshDecision);
      refreshDecisions.push(refreshDecision);
    }

    // 5. Update final state in repository
    const updatedRecord: KnowledgeUpdate = {
      ...update,
      status: currentStatus,
      lastFailureReason: execResult.errors.length > 0 ? execResult.errors.join('; ') : undefined,
    };
    await this.deps.repository.saveUpdate(updatedRecord);

    const result: KnowledgeUpdateResult = {
      updateId: update.updateId,
      status: currentStatus,
      success,
      partialSuccess,
      failure,
      appliedAreas: execResult.appliedAreas,
      failedAreas: execResult.failedAreas,
      skippedAreas: execResult.skippedAreas,
      affectedResources: plan.targetResources,
      affectedFeatures: plan.targetFeatures,
      previousKnowledgeVersion: latestVersionBefore?.versionId,
      newKnowledgeVersion: newVersion,
      invalidations,
      refreshDecisions,
      conflicts,
      warnings: execResult.warnings,
      errors: execResult.errors,
      retryEligible: currentStatus === 'PARTIALLY_APPLIED' || currentStatus === 'FAILED',
      processedAt: Date.now(),
      metadata: { ...update.metadata },
    };

    // 6. Emit event
    if (success || partialSuccess) {
      this.deps.eventBus?.publish(KNOWLEDGE_UPDATE_EVENTS.APPLIED, {
        eventName: KNOWLEDGE_UPDATE_EVENTS.APPLIED,
        updateId: update.updateId,
        result,
        timestamp: result.processedAt,
      });
    } else {
      this.deps.eventBus?.publish(KNOWLEDGE_UPDATE_EVENTS.FAILED, {
        eventName: KNOWLEDGE_UPDATE_EVENTS.FAILED,
        updateId: update.updateId,
        error: execResult.errors.join('; '),
        retryEligible: result.retryEligible,
        timestamp: result.processedAt,
      });
    }

    return result;
  }
}
