import type { LearningRollback } from '../models/LearningRollback.js';

export interface ILearningRollbackManager {
  rollbackLearning(deployedLearningId: string, reason: string, actor: string): Promise<LearningRollback>;
  getRollbackHistory(deployedLearningId?: string): Promise<LearningRollback[]>;
}
