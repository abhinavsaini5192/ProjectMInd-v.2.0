import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureDependencyMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Major dependency shift or new dependent feature added'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_dep_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_DEPENDENCY_EXPANDED',
      title: 'Dependency Milestone',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'DEPENDENCY_CHANGE',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('HIGH', 0.9, ['Dependency graph evolution']),
      relatedEventIds,
      importance: 'HIGH',
    };
  }
}
