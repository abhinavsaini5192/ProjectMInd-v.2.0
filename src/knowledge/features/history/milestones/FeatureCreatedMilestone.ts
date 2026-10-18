import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureCreatedMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Feature first created'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_created_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_CREATED',
      title: 'Feature Created',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'CREATION_EVENT',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('VERY_HIGH', 1.0, ['Authoritative creation record']),
      relatedEventIds,
      importance: 'CRITICAL',
    };
  }
}
