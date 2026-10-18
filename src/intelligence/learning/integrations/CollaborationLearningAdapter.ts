import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';

export class CollaborationLearningAdapter {
  constructor(private readonly deploymentManager: ILearningDeploymentManager) {}

  public async getRoleAffinityAdjustments(
    workspaceId: string,
    projectId?: string
  ): Promise<Map<string, number>> {
    const activeLearnings = await this.deploymentManager.getActiveLearnings(workspaceId, projectId);
    const collabLearnings = activeLearnings.filter((l) => l.target.system === 'COLLABORATION');

    const affinities = new Map<string, number>();
    for (const cl of collabLearnings) {
      const role = cl.appliedChange['targetRoleOrCapability'];
      const modifier = cl.appliedChange['affinityModifier'] ?? 0;
      if (role) {
        const current = affinities.get(role) ?? 0;
        affinities.set(role, current + modifier);
      }
    }

    return affinities;
  }
}
