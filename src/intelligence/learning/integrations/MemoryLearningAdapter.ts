import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';

export class MemoryLearningAdapter {
  constructor(private readonly deploymentManager: ILearningDeploymentManager) {}

  public async getStaleMemoryIds(workspaceId: string, projectId?: string): Promise<Set<string>> {
    const activeLearnings = await this.deploymentManager.getActiveLearnings(workspaceId, projectId);
    const memoryLearnings = activeLearnings.filter((l) => l.target.system === 'MEMORY');

    const staleIds = new Set<string>();
    for (const ml of memoryLearnings) {
      if (ml.appliedChange['action'] === 'FLAG_FOR_DECAY' && ml.appliedChange['memoryId']) {
        staleIds.add(ml.appliedChange['memoryId']);
      }
    }

    return staleIds;
  }
}
