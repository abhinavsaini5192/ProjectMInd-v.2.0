import type { KnowledgeRefreshDecision } from '../models/KnowledgeRefreshDecision.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';

export interface IKnowledgeRefreshManager {
  determineRefreshPolicy(
    update: KnowledgeUpdate,
    plan: KnowledgeUpdatePlan,
    affectedFeatures: readonly string[],
    affectedResources: readonly string[]
  ): Promise<KnowledgeRefreshDecision>;

  applyRefreshDecision(decision: KnowledgeRefreshDecision): Promise<void>;
}
