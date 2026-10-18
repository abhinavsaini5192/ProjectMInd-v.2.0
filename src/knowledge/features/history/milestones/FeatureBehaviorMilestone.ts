import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureBehaviorMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Major behavior or contract evolution introduced'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_beh_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_BEHAVIOR_EXPANDED',
      title: 'Behavior Evolution',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'BEHAVIOR_CHANGE',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('HIGH', 0.88, ['Behavior flow modification']),
      relatedEventIds,
      importance: 'HIGH',
    };
  }
}
