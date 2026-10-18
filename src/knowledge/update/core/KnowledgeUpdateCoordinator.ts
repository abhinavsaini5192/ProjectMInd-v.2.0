import type { IKnowledgeUpdateCoordinator } from '../interfaces/IKnowledgeUpdateCoordinator.js';
import type { KnowledgeUpdate, CreateKnowledgeUpdateParams } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';
import type { KnowledgeUpdateRun } from '../models/KnowledgeUpdateRun.js';
import type { KnowledgeUpdateStatus } from '../models/KnowledgeUpdateStatus.js';
import type { KnowledgeVersion } from '../models/KnowledgeVersion.js';
import type { KnowledgeInvalidation } from '../models/KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from '../models/KnowledgeRefreshDecision.js';
import type { ExecutionObservation } from '../../../agent/observation/models/ExecutionObservation.js';
import type { VerificationRecord } from '../../../verification/models/VerificationRecord.js';
import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { IKnowledgeUpdatePlanner } from '../interfaces/IKnowledgeUpdatePlanner.js';
import type { IKnowledgeUpdateProcessor } from '../interfaces/IKnowledgeUpdateProcessor.js';
import type { IKnowledgeUpdateValidator } from '../interfaces/IKnowledgeUpdateValidator.js';
import type { IKnowledgeUpdateExplainer } from '../interfaces/IKnowledgeUpdateExplainer.js';
import type { IKnowledgeVersionManager } from '../interfaces/IKnowledgeVersionManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { KnowledgeUpdateNormalizer } from './KnowledgeUpdateNormalizer.js';
import { KnowledgeUpdateDeduplicator } from './KnowledgeUpdateDeduplicator.js';
import { KnowledgeUpdateRunManager } from './KnowledgeUpdateRunManager.js';
import { ExecutionObservationAdapter } from '../adapters/ExecutionObservationAdapter.js';
import { VerificationEvidenceAdapter } from '../adapters/VerificationEvidenceAdapter.js';
import { KNOWLEDGE_UPDATE_EVENTS } from '../events/KnowledgeUpdateEvents.js';
import { KnowledgeUpdateNotFoundError } from '../errors/KnowledgeUpdateError.js';

export interface KnowledgeUpdateCoordinatorDependencies {
  readonly repository: IKnowledgeUpdateRepository;
  readonly normalizer?: KnowledgeUpdateNormalizer | undefined;
  readonly validator: IKnowledgeUpdateValidator;
  readonly deduplicator?: KnowledgeUpdateDeduplicator | undefined;
  readonly planner: IKnowledgeUpdatePlanner;
  readonly processor: IKnowledgeUpdateProcessor;
  readonly versionManager: IKnowledgeVersionManager;
  readonly runManager?: KnowledgeUpdateRunManager | undefined;
  readonly explainer: IKnowledgeUpdateExplainer;
  readonly observationAdapter?: ExecutionObservationAdapter | undefined;
  readonly verificationAdapter?: VerificationEvidenceAdapter | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export class KnowledgeUpdateCoordinator implements IKnowledgeUpdateCoordinator {
  private readonly normalizer: KnowledgeUpdateNormalizer;
  private readonly deduplicator: KnowledgeUpdateDeduplicator;
  private readonly runManager: KnowledgeUpdateRunManager;
  private readonly observationAdapter: ExecutionObservationAdapter;
  private readonly verificationAdapter: VerificationEvidenceAdapter;

  constructor(private readonly deps: KnowledgeUpdateCoordinatorDependencies) {
    this.normalizer = deps.normalizer ?? new KnowledgeUpdateNormalizer();
    this.deduplicator = deps.deduplicator ?? new KnowledgeUpdateDeduplicator(deps.repository);
    this.runManager = deps.runManager ?? new KnowledgeUpdateRunManager(deps.repository);
    this.observationAdapter = deps.observationAdapter ?? new ExecutionObservationAdapter();
    this.verificationAdapter = deps.verificationAdapter ?? new VerificationEvidenceAdapter();
  }

  public async processKnowledgeUpdate(params: CreateKnowledgeUpdateParams): Promise<KnowledgeUpdateResult> {
    // 1. Normalize
    const normalized = this.normalizer.normalize(params);

    // 2. Validate
    this.deps.validator.validate(normalized);
    const sanitizedMetadata = this.deps.validator.sanitizeMetadata(normalized.metadata);
    const validatedUpdate: KnowledgeUpdate = {
      ...normalized,
      status: 'VALIDATED',
      metadata: sanitizedMetadata,
    };

    // 3. Deduplication check
    const existing = await this.deduplicator.checkDuplicate(validatedUpdate);
    if (existing && existing.status === 'APPLIED') {
      const existingPlan = await this.deps.repository.getPlan(existing.updateId);
      const existingInvalidations = await this.deps.repository.getInvalidationsByUpdate(existing.updateId);
      const existingRefreshes = await this.deps.repository.getRefreshDecisionsByUpdate(existing.updateId);
      const existingConflicts = await this.deps.repository.getConflictsByUpdate(existing.updateId);
      const latestVersion = await this.deps.versionManager.getLatestVersion(existing.repositoryId);

      return {
        updateId: existing.updateId,
        status: 'APPLIED',
        success: true,
        partialSuccess: false,
        failure: false,
        appliedAreas: existingPlan ? existingPlan.targetKnowledgeAreas : [],
        failedAreas: [],
        skippedAreas: existingPlan ? existingPlan.skippedAreas : [],
        affectedResources: existing.affectedResources,
        affectedFeatures: existing.affectedFeatures,
        previousKnowledgeVersion: latestVersion?.versionId,
        newKnowledgeVersion: latestVersion?.versionId,
        invalidations: existingInvalidations,
        refreshDecisions: existingRefreshes,
        conflicts: existingConflicts,
        warnings: ['Update deduplicated; existing applied update returned.'],
        errors: [],
        retryEligible: false,
        processedAt: Date.now(),
        metadata: existing.metadata,
      };
    }

    // 4. Save & emit received
    await this.deps.repository.saveUpdate(validatedUpdate);
    this.deps.eventBus?.publish(KNOWLEDGE_UPDATE_EVENTS.RECEIVED, {
      eventName: KNOWLEDGE_UPDATE_EVENTS.RECEIVED,
      update: validatedUpdate,
      timestamp: Date.now(),
    });

    // 5. Plan
    const plan = await this.deps.planner.plan(validatedUpdate);
    await this.deps.repository.savePlan(plan);
    this.deps.eventBus?.publish(KNOWLEDGE_UPDATE_EVENTS.PLANNED, {
      eventName: KNOWLEDGE_UPDATE_EVENTS.PLANNED,
      updateId: validatedUpdate.updateId,
      plan,
      timestamp: Date.now(),
    });

    // 6. Process
    return this.deps.processor.process(validatedUpdate, plan);
  }

  public async processKnowledgeUpdates(paramsList: CreateKnowledgeUpdateParams[]): Promise<KnowledgeUpdateRun> {
    const first = paramsList[0];
    if (!first) {
      return this.runManager.startRun('default', undefined, []);
    }
    const repositoryId = first.repositoryId;
    const workspaceId = first.workspaceId;

    const latestVersionBefore = await this.deps.versionManager.getLatestVersion(repositoryId);
    const normalizedList = paramsList.map((p) => this.normalizer.normalize(p));
    const deduplicatedList = this.deduplicator.deduplicateBatch(normalizedList);

    const run = await this.runManager.startRun(
      repositoryId,
      workspaceId,
      deduplicatedList.map((u) => u.updateId),
      latestVersionBefore?.versionId
    );

    const results: KnowledgeUpdateResult[] = [];
    for (const update of deduplicatedList) {
      try {
        const res = await this.processKnowledgeUpdate(update);
        results.push(res);
      } catch (err: any) {
        results.push({
          updateId: update.updateId,
          status: 'FAILED',
          success: false,
          partialSuccess: false,
          failure: true,
          appliedAreas: [],
          failedAreas: update.affectedKnowledgeAreas,
          skippedAreas: [],
          affectedResources: update.affectedResources,
          affectedFeatures: update.affectedFeatures,
          invalidations: [],
          refreshDecisions: [],
          conflicts: [],
          warnings: [],
          errors: [err.message || String(err)],
          retryEligible: true,
          processedAt: Date.now(),
          metadata: update.metadata,
        });
      }
    }

    const latestVersionAfter = await this.deps.versionManager.getLatestVersion(repositoryId);
    return this.runManager.completeRun(run, results, latestVersionAfter?.versionId);
  }

  public async applyExecutionObservations(observations: readonly ExecutionObservation[]): Promise<KnowledgeUpdateRun> {
    const paramsList = this.observationAdapter.batchToUpdateParams(observations);
    return this.processKnowledgeUpdates(paramsList);
  }

  public async applyVerificationEvidence(evidence: readonly VerificationRecord[]): Promise<KnowledgeUpdateRun> {
    const paramsList = this.verificationAdapter.batchToUpdateParams(evidence);
    return this.processKnowledgeUpdates(paramsList);
  }

  public async planKnowledgeUpdate(params: CreateKnowledgeUpdateParams): Promise<KnowledgeUpdatePlan> {
    const normalized = this.normalizer.normalize(params);
    this.deps.validator.validate(normalized);
    return this.deps.planner.plan(normalized);
  }

  public async getKnowledgeUpdate(updateId: string): Promise<KnowledgeUpdate | null> {
    return this.deps.repository.getUpdate(updateId);
  }

  public async getKnowledgeUpdateRun(runId: string): Promise<KnowledgeUpdateRun | null> {
    return this.deps.repository.getRun(runId);
  }

  public async getKnowledgeUpdateStatus(updateId: string): Promise<KnowledgeUpdateStatus | null> {
    const update = await this.deps.repository.getUpdate(updateId);
    return update?.status ?? null;
  }

  public async getKnowledgeVersion(repositoryId: string): Promise<KnowledgeVersion | null> {
    return this.deps.versionManager.getLatestVersion(repositoryId);
  }

  public async getPendingKnowledgeUpdates(repositoryId: string): Promise<KnowledgeUpdate[]> {
    return this.deps.repository.getPendingUpdates(repositoryId);
  }

  public async retryKnowledgeUpdate(updateId: string): Promise<KnowledgeUpdateResult> {
    const existing = await this.deps.repository.getUpdate(updateId);
    if (!existing) {
      throw new KnowledgeUpdateNotFoundError(updateId);
    }

    const retriedUpdate: KnowledgeUpdate = {
      ...existing,
      status: 'RETRY_PENDING',
      retryCount: existing.retryCount + 1,
    };
    await this.deps.repository.saveUpdate(retriedUpdate);

    let plan = await this.deps.repository.getPlan(updateId);
    if (!plan) {
      plan = await this.deps.planner.plan(retriedUpdate);
      await this.deps.repository.savePlan(plan);
    }

    return this.deps.processor.process(retriedUpdate, plan);
  }

  public async getKnowledgeInvalidations(updateId: string): Promise<KnowledgeInvalidation[]> {
    return this.deps.repository.getInvalidationsByUpdate(updateId);
  }

  public async getRefreshDecisions(updateId: string): Promise<KnowledgeRefreshDecision[]> {
    return this.deps.repository.getRefreshDecisionsByUpdate(updateId);
  }

  public async explainKnowledgeUpdate(updateId: string): Promise<string> {
    const update = await this.deps.repository.getUpdate(updateId);
    if (!update) {
      throw new KnowledgeUpdateNotFoundError(updateId);
    }

    const plan = await this.deps.repository.getPlan(updateId);
    return this.deps.explainer.explain(update, plan ?? undefined);
  }
}
