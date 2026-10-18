import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureStabilizedMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Feature stabilized with minimal churn, stable mappings and verified behaviors'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_stabilized_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_STABILIZED',
      title: 'Feature Stabilized',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'STABILITY_METRICS',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('HIGH', 0.9, ['Low change churn and consistent mappings']),
      relatedEventIds,
      importance: 'HIGH',
    };
  }
}
