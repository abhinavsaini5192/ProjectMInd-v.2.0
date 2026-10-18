import type { SelectedContextData } from '../interfaces/IContextSelector.js';
import type { ContextFeature } from '../models/ContextFeature.js';
import type { ContextResource } from '../models/ContextResource.js';

export class ContextCompressionPolicy {
  public static compress(data: SelectedContextData): SelectedContextData {
    const compressedFeatures: ContextFeature[] = data.features.map((f) => ({
      ...f,
      description: f.description.length > 120 ? `${f.description.slice(0, 117)}...` : f.description,
      entryPoints: f.entryPoints.slice(0, 2),
      primaryFlows: f.primaryFlows.slice(0, 2),
      risks: f.risks.slice(0, 2),
      recentMilestones: f.recentMilestones?.slice(0, 1),
    }));

    const compressedResources: ContextResource[] = data.resources.map((r) => ({
      ...r,
      snippet: undefined,
      metadata: undefined,
    }));

    return {
      ...data,
      features: compressedFeatures,
      resources: compressedResources,
      behaviorFlows: data.behaviorFlows.slice(0, 3),
      tests: data.tests.slice(0, 3),
      risks: data.risks.slice(0, 3),
      milestones: data.milestones.slice(0, 2),
      explanations: {}, // Omit explanations in compact mode to save budget
    };
  }
}
