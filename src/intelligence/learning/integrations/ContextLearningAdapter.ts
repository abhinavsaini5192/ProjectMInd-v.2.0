import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';
import type { ContextCandidate } from '../../../context/models/ContextCandidate.js';

export class ContextLearningAdapter {
  constructor(private readonly deploymentManager: ILearningDeploymentManager) {}

  public async applyLearnedAdjustments(
    candidates: readonly ContextCandidate[],
    workspaceId: string,
    projectId?: string
  ): Promise<ContextCandidate[]> {
    const activeLearnings = await this.deploymentManager.getActiveLearnings(workspaceId, projectId);
    const contextLearnings = activeLearnings.filter((l) => l.target.system === 'CONTEXT');

    if (contextLearnings.length === 0) {
      return [...candidates];
    }

    // Map resourceId -> weightAdjustment
    const adjustmentMap = new Map<string, { delta: number; mandatory: boolean }>();
    for (const cl of contextLearnings) {
      const resId = cl.appliedChange['resourceId'];
      const delta = cl.appliedChange['weightAdjustment'] ?? 0;
      const mandatory = cl.appliedChange['mandatoryInclude'] ?? false;
      if (resId) {
        adjustmentMap.set(resId, { delta, mandatory });
      }
    }

    return candidates.map((cand) => {
      const candId = cand.id ?? cand.candidateId;
      const adj = (candId ? adjustmentMap.get(candId) : undefined) ?? (cand.path ? adjustmentMap.get(cand.path) : undefined);
      if (!adj) return cand;

      const newScore = Math.min(1.0, Math.max(0.01, cand.score + adj.delta));
      const newEvidence = `${cand.primaryEvidence} [Learned weight adjustment: ${adj.delta >= 0 ? '+' : ''}${adj.delta.toFixed(2)}]`;

      return {
        ...cand,
        score: Math.round(newScore * 1000) / 1000,
        primaryEvidence: newEvidence,
        priority: adj.mandatory ? 'CRITICAL' : cand.priority,
        isMandatory: Boolean(cand.isMandatory || adj.mandatory),
      };
    });
  }
}
