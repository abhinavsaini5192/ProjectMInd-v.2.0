import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';

export interface IKnowledgeUpdateProcessor {
  process(update: KnowledgeUpdate, plan: KnowledgeUpdatePlan): Promise<KnowledgeUpdateResult>;
}

export interface IKnowledgeUpdateExecutor {
  executePlan(update: KnowledgeUpdate, plan: KnowledgeUpdatePlan): Promise<{
    appliedAreas: import('../models/KnowledgeArea.js').KnowledgeArea[];
    failedAreas: import('../models/KnowledgeArea.js').KnowledgeArea[];
    skippedAreas: import('../models/KnowledgeArea.js').KnowledgeArea[];
    errors: string[];
    warnings: string[];
  }>;
}
