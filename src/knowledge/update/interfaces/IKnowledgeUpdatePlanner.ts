import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';

export interface IKnowledgeUpdatePlanner {
  plan(update: KnowledgeUpdate): Promise<KnowledgeUpdatePlan>;
  planBatch(updates: KnowledgeUpdate[]): Promise<KnowledgeUpdatePlan[]>;
}
