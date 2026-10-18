import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureDeprecatedMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Feature marked as deprecated'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_deprec_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_DEPRECATED',
      title: 'Feature Deprecated',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'DEPRECATION_EVENT',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('VERY_HIGH', 0.98, ['Explicit deprecation event']),
      relatedEventIds,
      importance: 'CRITICAL',
    };
  }
}
