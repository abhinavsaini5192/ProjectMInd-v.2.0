import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureActivatedMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Feature activated in active environment'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_activated_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_ACTIVATED',
      title: 'Feature Activated',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'STATUS_CHANGE',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('VERY_HIGH', 0.95, ['Status change to ACTIVE']),
      relatedEventIds,
      importance: 'HIGH',
    };
  }
}
