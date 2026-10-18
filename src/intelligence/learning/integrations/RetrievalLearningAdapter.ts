import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';
import type { RetrievalResult } from '../../../retrieval/models/RetrievalResult.js';

export class RetrievalLearningAdapter {
  constructor(private readonly deploymentManager: ILearningDeploymentManager) {}

  public async applyLearnedRanking(
    results: readonly RetrievalResult[],
    workspaceId: string,
    projectId?: string
  ): Promise<RetrievalResult[]> {
    const activeLearnings = await this.deploymentManager.getActiveLearnings(workspaceId, projectId);
    const retrievalLearnings = activeLearnings.filter((l) => l.target.system === 'RETRIEVAL');

    if (retrievalLearnings.length === 0) {
      return [...results];
    }

    const deltas = new Map<string, number>();
    for (const rl of retrievalLearnings) {
      const resId = rl.appliedChange['resourceId'];
      const delta = rl.appliedChange['rankingScoreDelta'] ?? 0;
      if (resId) {
        deltas.set(resId, delta);
      }
    }

    const modified = results.map((res) => {
      const delta = deltas.get(res.resourceId);
      if (delta === undefined) return res;

      const newScore = Math.min(1.0, Math.max(0.01, res.score + delta));
      return {
        ...res,
        score: Math.round(newScore * 1000) / 1000,
        metadata: {
          ...res.metadata,
          learnedScoreDelta: delta,
        },
      };
    });

    // Re-sort descending by score
    return modified.sort((a, b) => b.score - a.score);
  }
}
