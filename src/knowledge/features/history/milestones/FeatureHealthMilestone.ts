import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureHealthMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Significant health improvement achieved'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_health_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_HEALTH_IMPROVED',
      title: 'Health Milestone',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'HEALTH_IMPROVEMENT',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('HIGH', 0.9, ['Health assessment score improvement']),
      relatedEventIds,
      importance: 'HIGH',
    };
  }
}
