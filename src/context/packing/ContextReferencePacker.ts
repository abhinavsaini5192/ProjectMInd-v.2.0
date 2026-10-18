import type { ContextFeature } from '../models/ContextFeature.js';
import type { ContextResource } from '../models/ContextResource.js';

export class ContextReferencePacker {
  public static bindFeatureReferences(
    features: ContextFeature[],
    resources: ContextResource[],
    behaviorFlows: any[]
  ): ContextFeature[] {
    const resourceMap = new Map<string, ContextResource[]>();
    for (const r of resources) {
      const list = resourceMap.get(r.featureId) ?? [];
      list.push(r);
      resourceMap.set(r.featureId, list);
    }

    return features.map((f) => {
      const boundResources = resourceMap.get(f.featureId) ?? f.resources;
      return {
        ...f,
        resources: boundResources,
      };
    });
  }
}
