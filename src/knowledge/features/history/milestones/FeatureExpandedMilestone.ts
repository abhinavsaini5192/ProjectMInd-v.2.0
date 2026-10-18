import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureExpandedMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Feature significantly expanded with new flows/endpoints/resources'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_expanded_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_EXPANDED',
      title: 'Feature Expanded',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'EXPANSION_EVIDENCE',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('HIGH', 0.9, ['Significant increase in resources or behaviors']),
      relatedEventIds,
      importance: 'HIGH',
    };
  }
}
