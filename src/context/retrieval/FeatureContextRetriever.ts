import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';
import type { ContextWarning } from '../models/ContextWarning.js';

export interface FeatureRetrievalResult {
  knowledgeMap: Map<string, FeatureKnowledgeResponse>;
  directFeatures: string[];
  dependencyFeatures: string[];
  warnings: ContextWarning[];
}

export class FeatureContextRetriever {
  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

  public async retrieveFeatures(
    targetFeatureIds: string[],
    maxDepth: number = 1
  ): Promise<FeatureRetrievalResult> {
    const knowledgeMap = new Map<string, FeatureKnowledgeResponse>();
    const directFeatures: string[] = [];
    const dependencyFeatures = new Set<string>();
    const warnings: ContextWarning[] = [];
    const visited = new Set<string>();

    const queue: Array<{ id: string; depth: number; isDirect: boolean }> = targetFeatureIds.map((id) => ({
      id,
      depth: 0,
      isDirect: true,
    }));

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const { id, depth, isDirect } = item;
      if (visited.has(id)) {
        continue;
      }
      visited.add(id);

      try {
        const resp = await this.featureKnowledgeApi.getFeatureKnowledge(id);
        if (resp && resp.success && resp.profile) {
          knowledgeMap.set(id, resp);
          if (isDirect) {
            directFeatures.push(id);
          } else {
            dependencyFeatures.add(id);
          }

          // Traverse dependencies if within maxDepth
          const deps = resp.profile.dependencies?.data?.dependencies;
          if (depth < maxDepth && deps && Array.isArray(deps)) {
            for (const dep of deps) {
              const targetId = dep.featureId;
              if (targetId && !visited.has(targetId)) {
                queue.push({ id: targetId, depth: depth + 1, isDirect: false });
              }
            }
          }
        } else {
          warnings.push({
            type: 'UNRESOLVED_FEATURE',
            message: `Feature '${id}' could not be resolved in feature knowledge repository.`,
            section: 'IDENTITY',
            targetId: id,
          });
        }
      } catch (err: any) {
        warnings.push({
          type: 'PARTIAL_PROVIDER_FAILURE',
          message: `Failed to retrieve knowledge for feature '${id}': ${err.message ?? String(err)}`,
          section: 'IDENTITY',
          targetId: id,
          details: { error: String(err) },
        });
      }
    }

    return {
      knowledgeMap,
      directFeatures,
      dependencyFeatures: Array.from(dependencyFeatures),
      warnings,
    };
  }
}
