import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';

export class FeatureLearningAdapter {
  constructor(private readonly deploymentManager: ILearningDeploymentManager) {}

  public async getFeatureAssociationBoosts(
    workspaceId: string,
    projectId?: string
  ): Promise<Map<string, number>> {
    const activeLearnings = await this.deploymentManager.getActiveLearnings(workspaceId, projectId);
    const featureLearnings = activeLearnings.filter((l) => l.target.system === 'FEATURE');

    const boosts = new Map<string, number>();
    for (const fl of featureLearnings) {
      const featureId = fl.appliedChange['featureId'];
      const delta = fl.appliedChange['associationScoreDelta'] ?? 0;
      if (featureId) {
        const cur = boosts.get(featureId) ?? 0;
        boosts.set(featureId, cur + delta);
      }
    }

    return boosts;
  }
}
