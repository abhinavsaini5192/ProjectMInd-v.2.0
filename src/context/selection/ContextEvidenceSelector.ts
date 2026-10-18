import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';
import { ContextDeduplicator } from './ContextDeduplicator.js';

export interface SelectedEvidence {
  behaviorFlows: any[];
  tests: any[];
  risks: any[];
  milestones: any[];
}

export class ContextEvidenceSelector {
  public static selectEvidence(
    knowledgeMap: Map<string, FeatureKnowledgeResponse>
  ): SelectedEvidence {
    const rawFlows: any[] = [];
    const rawTests: any[] = [];
    const rawRisks: any[] = [];
    const rawMilestones: any[] = [];

    for (const [, resp] of knowledgeMap.entries()) {
      const behavior = resp.profile.behavior?.data;
      if (behavior) {
        if (behavior.primaryFlows) rawFlows.push(...behavior.primaryFlows);
        if (behavior.failureFlows) rawFlows.push(...behavior.failureFlows);
      }

      const mappings = resp.profile.mappings?.data?.mappings;
      if (mappings) {
        const testMappings = mappings.filter((m) => m.role?.toUpperCase() === 'TEST');
        rawTests.push(...testMappings);
      }

      const health = resp.profile.health?.data;
      if (health?.risks) {
        rawRisks.push(...health.risks);
      }

      const history = resp.profile.history?.data;
      if (history?.milestones) {
        rawMilestones.push(...history.milestones);
      }
    }

    return {
      behaviorFlows: ContextDeduplicator.deduplicateItems(rawFlows),
      tests: ContextDeduplicator.deduplicateItems(rawTests),
      risks: ContextDeduplicator.deduplicateItems(rawRisks),
      milestones: ContextDeduplicator.deduplicateItems(rawMilestones),
    };
  }
}
