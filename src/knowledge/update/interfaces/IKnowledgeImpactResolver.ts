import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdateImpact } from '../models/KnowledgeUpdateImpact.js';

export interface IKnowledgeImpactResolver {
  resolveImpact(update: KnowledgeUpdate): Promise<KnowledgeUpdateImpact>;
  resolveBatchImpact(updates: KnowledgeUpdate[]): Promise<KnowledgeUpdateImpact>;
}
