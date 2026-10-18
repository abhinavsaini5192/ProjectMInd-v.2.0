import type { DeployedLearning } from '../models/DeployedLearning.js';

export interface ILearningDeploymentManager {
  deployCandidate(candidateId: string, actor: string): Promise<DeployedLearning>;
  disableLearning(deployedLearningId: string, actor: string): Promise<DeployedLearning>;
  getActiveLearnings(workspaceId: string, projectId?: string): Promise<DeployedLearning[]>;
}
