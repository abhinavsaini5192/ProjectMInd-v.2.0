import type {
  IReconciliationService,
  InconsistencyRecord,
  ReconciliationPlan,
  ReconciliationReport,
} from './IReconciliationService.js';
import type { IKnowledgeVersionManager } from '../../knowledge/update/interfaces/IKnowledgeVersionManager.js';
import type { IJobDispatcher } from '../../jobs/dispatch/IJobDispatcher.js';

export class KnowledgeReconciliationService implements IReconciliationService {
  private readonly repositoryIds = new Set<string>();

  constructor(
    private readonly versionManager?: IKnowledgeVersionManager | undefined,
    private readonly jobDispatcher?: IJobDispatcher | undefined
  ) {}

  public registerRepository(repositoryId: string): void {
    this.repositoryIds.add(repositoryId);
  }

  public async inspectConsistency(repositoryId: string): Promise<ReconciliationPlan> {
    const inconsistencies: InconsistencyRecord[] = [];
    const actions: string[] = [];

    if (this.versionManager) {
      const latest = await this.versionManager.getLatestVersion(repositoryId);
      if (latest) {
        // Check if any registered areas are missing from latest version
        if (latest.affectedFeatures.length === 0 && latest.affectedResources.length > 0) {
          inconsistencies.push({
            resourceId: `repo:${repositoryId}`,
            type: 'MISSING_DERIVED_STATE',
            sourceVersion: latest.versionNumber,
            description: `Repository '${repositoryId}' version ${latest.versionNumber} has resources updated but no feature mappings updated`,
            severity: 'MEDIUM',
          });
          actions.push(`Queue feature analysis for repository '${repositoryId}'`);
        }
      }
    }

    const requiresManualReview = inconsistencies.some((i) => i.severity === 'HIGH');
    return {
      inconsistencies,
      actions,
      requiresManualReview,
    };
  }

  public async reconcileRepository(repositoryId: string): Promise<ReconciliationReport> {
    const start = Date.now();
    const plan = await this.inspectConsistency(repositoryId);
    const actionsApplied: string[] = [];
    const manualReviewItems: InconsistencyRecord[] = [];

    for (const inconsistency of plan.inconsistencies) {
      if (inconsistency.severity === 'HIGH') {
        manualReviewItems.push(inconsistency);
        continue;
      }

      // Safe automated recovery
      if (inconsistency.type === 'MISSING_DERIVED_STATE' && this.jobDispatcher) {
        try {
          await this.jobDispatcher.dispatch({
            type: 'FEATURE_MAPPING',
            workspaceId: 'default',
            repositoryId,
            payload: { repositoryId },
            idempotencyKey: `recon-${repositoryId}-${inconsistency.sourceVersion}`,
          });
          actionsApplied.push(`Dispatched FEATURE_MAPPING job for ${repositoryId}`);
        } catch {
          manualReviewItems.push(inconsistency);
        }
      } else {
        actionsApplied.push(`Resolved: ${inconsistency.description}`);
      }
    }

    return {
      inconsistenciesDetected: plan.inconsistencies.length,
      inconsistenciesResolved: actionsApplied.length,
      actionsApplied,
      manualReviewItems,
      durationMs: Date.now() - start,
    };
  }

  public async reconcileAll(): Promise<ReconciliationReport> {
    const start = Date.now();
    let detected = 0;
    let resolved = 0;
    const actionsApplied: string[] = [];
    const manualReviewItems: InconsistencyRecord[] = [];

    for (const repoId of this.repositoryIds) {
      const rep = await this.reconcileRepository(repoId);
      detected += rep.inconsistenciesDetected;
      resolved += rep.inconsistenciesResolved;
      actionsApplied.push(...rep.actionsApplied);
      manualReviewItems.push(...rep.manualReviewItems);
    }

    return {
      inconsistenciesDetected: detected,
      inconsistenciesResolved: resolved,
      actionsApplied,
      manualReviewItems,
      durationMs: Date.now() - start,
    };
  }
}
