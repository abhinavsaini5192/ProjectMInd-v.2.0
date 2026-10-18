import { randomUUID } from 'crypto';
import type { IKnowledgeUpdatePlanner } from '../interfaces/IKnowledgeUpdatePlanner.js';
import type { IKnowledgeImpactResolver } from '../interfaces/IKnowledgeImpactResolver.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan, PlannedOperation } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';

export class KnowledgeUpdatePlanner implements IKnowledgeUpdatePlanner {
  constructor(private readonly impactResolver: IKnowledgeImpactResolver) {}

  public async plan(update: KnowledgeUpdate): Promise<KnowledgeUpdatePlan> {
    const planId = randomUUID();
    const impact = await this.impactResolver.resolveImpact(update);

    const allTargetFeatures = Array.from(
      new Set([...impact.directlyAffectedFeatures, ...impact.downstreamAffectedFeatures])
    ).sort();

    const allTargetResources = [...update.affectedResources].sort();
    const targetKnowledgeAreas = [...impact.affectedKnowledgeAreas].sort();

    const operations: PlannedOperation[] = [];
    const invalidationTargets: string[] = [];
    const refreshTargets: string[] = [];
    const warnings: string[] = [];
    const conflicts: string[] = [];
    const reasonCodes: string[] = [];

    // Helper to add operations with dependencies
    let lastMapOpId: string | undefined;

    // Stage 0: Resource Invalidation
    for (const res of allTargetResources) {
      invalidationTargets.push(`RESOURCE:${res}`);
    }

    // Stage 1: Mapping
    if (targetKnowledgeAreas.includes('FEATURE_MAPPING') && allTargetFeatures.length > 0) {
      for (const featId of allTargetFeatures) {
        const opId = `op_map_${featId}`;
        operations.push({
          operationId: opId,
          area: 'FEATURE_MAPPING',
          action: update.updateType === 'RESOURCE_DELETED' ? 'DEACTIVATE_MAPPING' : 'MAP',
          targetId: featId,
          dependencies: [],
          payload: { resources: allTargetResources },
        });
        lastMapOpId = opId;
        invalidationTargets.push(`FEATURE_MAPPING:${featId}`);
      }
      reasonCodes.push('SCHEDULED_FEATURE_MAPPING_UPDATE');
    }

    // Stage 2: Dependencies
    let lastDepOpId: string | undefined;
    if (targetKnowledgeAreas.includes('FEATURE_DEPENDENCIES') && allTargetFeatures.length > 0) {
      for (const featId of allTargetFeatures) {
        const opId = `op_dep_${featId}`;
        operations.push({
          operationId: opId,
          area: 'FEATURE_DEPENDENCIES',
          action: 'UPDATE_DEPENDENCY',
          targetId: featId,
          dependencies: lastMapOpId ? [lastMapOpId] : [],
        });
        lastDepOpId = opId;
        invalidationTargets.push(`FEATURE_DEPENDENCY:${featId}`);
      }
      reasonCodes.push('SCHEDULED_FEATURE_DEPENDENCY_UPDATE');
    }

    // Stage 3: Behavior
    let lastBehOpId: string | undefined;
    if (targetKnowledgeAreas.includes('FEATURE_BEHAVIOR') && allTargetFeatures.length > 0) {
      for (const featId of allTargetFeatures) {
        const opId = `op_beh_${featId}`;
        operations.push({
          operationId: opId,
          area: 'FEATURE_BEHAVIOR',
          action: 'ANALYZE_BEHAVIOR',
          targetId: featId,
          dependencies: lastMapOpId ? [lastMapOpId] : [],
        });
        lastBehOpId = opId;
        invalidationTargets.push(`FEATURE_BEHAVIOR:${featId}`);
      }
      reasonCodes.push('SCHEDULED_FEATURE_BEHAVIOR_UPDATE');
    }

    // Stage 4: Health & Risk
    let lastHltOpId: string | undefined;
    if (targetKnowledgeAreas.includes('FEATURE_HEALTH') && allTargetFeatures.length > 0) {
      for (const featId of allTargetFeatures) {
        const opId = `op_hlt_${featId}`;
        const deps: string[] = [];
        if (lastMapOpId) deps.push(lastMapOpId);
        if (lastBehOpId) deps.push(lastBehOpId);

        operations.push({
          operationId: opId,
          area: 'FEATURE_HEALTH',
          action: 'ANALYZE_HEALTH',
          targetId: featId,
          dependencies: deps,
        });
        lastHltOpId = opId;
        invalidationTargets.push(`FEATURE_HEALTH:${featId}`);
        invalidationTargets.push(`FEATURE_PROFILE:${featId}`);
      }
      reasonCodes.push('SCHEDULED_FEATURE_HEALTH_UPDATE');
    }

    // Stage 5: Impact
    if (targetKnowledgeAreas.includes('FEATURE_IMPACT') && allTargetFeatures.length > 0) {
      for (const featId of allTargetFeatures) {
        const opId = `op_imp_${featId}`;
        operations.push({
          operationId: opId,
          area: 'FEATURE_IMPACT',
          action: 'ANALYZE_IMPACT',
          targetId: featId,
          dependencies: lastDepOpId ? [lastDepOpId] : [],
        });
        invalidationTargets.push(`FEATURE_IMPACT:${featId}`);
      }
      reasonCodes.push('SCHEDULED_FEATURE_IMPACT_UPDATE');
    }

    // Stage 6: History
    if (targetKnowledgeAreas.includes('FEATURE_HISTORY') && allTargetFeatures.length > 0) {
      for (const featId of allTargetFeatures) {
        const opId = `op_hist_${featId}`;
        operations.push({
          operationId: opId,
          area: 'FEATURE_HISTORY',
          action: 'APPEND_HISTORY',
          targetId: featId,
          dependencies: lastHltOpId ? [lastHltOpId] : [],
        });
        invalidationTargets.push(`FEATURE_HISTORY:${featId}`);
      }
      reasonCodes.push('SCHEDULED_FEATURE_HISTORY_UPDATE');
    }

    // Stage 7: Context Invalidation
    if (allTargetFeatures.length > 0) {
      invalidationTargets.push('CONTEXT_PACKAGE:ALL_AFFECTED');
      if (update.agentSessionId) {
        refreshTargets.push(update.agentSessionId);
      }
      if (update.taskId) {
        refreshTargets.push(`TASK:${update.taskId}`);
      }
    }

    // Identify skipped areas
    const ALL_AREAS: KnowledgeArea[] = [
      'FEATURE_MAPPING',
      'FEATURE_DEPENDENCIES',
      'FEATURE_BEHAVIOR',
      'FEATURE_HEALTH',
      'FEATURE_RISK',
      'FEATURE_IMPACT',
      'FEATURE_HISTORY',
      'RESOURCE_METADATA',
      'SYMBOL_KNOWLEDGE',
      'API_KNOWLEDGE',
      'CONFIGURATION',
      'DATABASE_KNOWLEDGE',
      'CONTEXT',
      'VERIFICATION',
    ];
    const skippedAreas = ALL_AREAS.filter((a) => !targetKnowledgeAreas.includes(a));

    if (allTargetFeatures.length === 0 && allTargetResources.length > 0) {
      warnings.push(`Resources [${allTargetResources.join(', ')}] are not currently mapped to any known features.`);
    }

    return {
      planId,
      updateId: update.updateId,
      targetResources: allTargetResources,
      targetFeatures: allTargetFeatures,
      targetKnowledgeAreas,
      operations,
      invalidationTargets: Array.from(new Set(invalidationTargets)),
      refreshTargets: Array.from(new Set(refreshTargets)),
      expectedNewKnowledgeVersion: undefined, // Resolved by VersionManager
      confidence: impact.confidence,
      warnings,
      conflicts,
      skippedAreas,
      reasonCodes,
      createdAt: Date.now(),
    };
  }

  public async planBatch(updates: readonly KnowledgeUpdate[]): Promise<KnowledgeUpdatePlan[]> {
    const plans: KnowledgeUpdatePlan[] = [];
    for (const update of updates) {
      plans.push(await this.plan(update));
    }
    return plans;
  }
}
