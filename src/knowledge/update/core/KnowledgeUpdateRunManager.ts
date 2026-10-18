import { randomUUID } from 'crypto';
import type { KnowledgeUpdateRun, KnowledgeRunStatistics } from '../models/KnowledgeUpdateRun.js';
import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';

export class KnowledgeUpdateRunManager {
  constructor(private readonly repository: IKnowledgeUpdateRepository) {}

  public async startRun(
    repositoryId: string,
    workspaceId: string | undefined,
    updateIds: readonly string[],
    knowledgeVersionBefore?: string | undefined
  ): Promise<KnowledgeUpdateRun> {
    const run: KnowledgeUpdateRun = {
      runId: randomUUID(),
      repositoryId,
      workspaceId,
      startedAt: Date.now(),
      updateIds: [...updateIds],
      status: 'RUNNING',
      knowledgeVersionBefore,
      affectedResources: [],
      affectedFeatures: [],
      updatedKnowledgeAreas: [],
      invalidations: [],
      refreshDecisions: [],
      conflicts: [],
      warnings: [],
      errors: [],
      statistics: {
        receivedUpdates: updateIds.length,
        normalizedUpdates: updateIds.length,
        deduplicatedUpdates: 0,
        plannedOperations: 0,
        appliedOperations: 0,
        skippedOperations: 0,
        failedOperations: 0,
        conflicts: 0,
        invalidations: 0,
        refreshRequests: 0,
        versionChanged: false,
      },
    };

    await this.repository.saveRun(run);
    return run;
  }

  public async completeRun(
    run: KnowledgeUpdateRun,
    results: readonly KnowledgeUpdateResult[],
    knowledgeVersionAfter?: string | undefined
  ): Promise<KnowledgeUpdateRun> {
    const affectedResources = new Set<string>();
    const affectedFeatures = new Set<string>();
    const updatedAreas = new Set<KnowledgeArea>();
    const allInvalidations: import('../models/KnowledgeInvalidation.js').KnowledgeInvalidation[] = [];
    const allRefreshes: import('../models/KnowledgeRefreshDecision.js').KnowledgeRefreshDecision[] = [];
    const allConflicts: import('../models/KnowledgeUpdateConflict.js').KnowledgeUpdateConflict[] = [];
    const allWarnings: string[] = [...run.warnings];
    const allErrors: string[] = [...run.errors];

    let appliedOps = 0;
    let failedOps = 0;
    let skippedOps = 0;
    let hasFailures = false;
    let hasSuccess = false;

    for (const res of results) {
      for (const r of res.affectedResources) affectedResources.add(r);
      for (const f of res.affectedFeatures) affectedFeatures.add(f);
      for (const a of res.appliedAreas) updatedAreas.add(a);
      for (const inv of res.invalidations) allInvalidations.push(inv);
      for (const ref of res.refreshDecisions) allRefreshes.push(ref);
      for (const conf of res.conflicts) allConflicts.push(conf);
      for (const w of res.warnings) allWarnings.push(w);
      for (const e of res.errors) allErrors.push(e);

      appliedOps += res.appliedAreas.length;
      failedOps += res.failedAreas.length;
      skippedOps += res.skippedAreas.length;

      if (res.failure) hasFailures = true;
      if (res.success || res.partialSuccess) hasSuccess = true;
    }

    let status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' = 'COMPLETED';
    if (hasFailures && !hasSuccess) {
      status = 'FAILED';
    } else if (hasFailures && hasSuccess) {
      status = 'PARTIALLY_COMPLETED';
    }

    const versionChanged =
      knowledgeVersionAfter !== undefined &&
      knowledgeVersionAfter !== run.knowledgeVersionBefore;

    const statistics: KnowledgeRunStatistics = {
      receivedUpdates: run.statistics.receivedUpdates,
      normalizedUpdates: run.statistics.normalizedUpdates,
      deduplicatedUpdates: run.statistics.deduplicatedUpdates,
      plannedOperations: appliedOps + failedOps + skippedOps,
      appliedOperations: appliedOps,
      skippedOperations: skippedOps,
      failedOperations: failedOps,
      conflicts: allConflicts.length,
      invalidations: allInvalidations.length,
      refreshRequests: allRefreshes.length,
      versionChanged,
    };

    const completedRun: KnowledgeUpdateRun = {
      ...run,
      completedAt: Date.now(),
      status,
      knowledgeVersionAfter,
      affectedResources: Array.from(affectedResources).sort(),
      affectedFeatures: Array.from(affectedFeatures).sort(),
      updatedKnowledgeAreas: Array.from(updatedAreas).sort(),
      invalidations: allInvalidations,
      refreshDecisions: allRefreshes,
      conflicts: allConflicts,
      warnings: Array.from(new Set(allWarnings)),
      errors: Array.from(new Set(allErrors)),
      statistics,
    };

    await this.repository.saveRun(completedRun);
    return completedRun;
  }
}
