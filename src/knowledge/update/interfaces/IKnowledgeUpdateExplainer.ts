import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';

export interface IKnowledgeUpdateExplainer {
  explain(
    update: KnowledgeUpdate,
    plan?: KnowledgeUpdatePlan | undefined,
    result?: KnowledgeUpdateResult | undefined
  ): string;
}
