import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureDiscoveredMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    relatedEventIds: string[] = [],
    details: string = 'Feature first discovered by ProjectMind'
  ): FeatureMilestone {
    return {
      milestoneId: `ms_discovered_${featureId}_${timestamp}`,
      featureId,
      milestoneType: 'FEATURE_DISCOVERED',
      title: 'Feature Discovered',
      description: details,
      timestamp,
      evidence: [
        {
          type: 'DISCOVERY_EVENT',
          description: details,
        },
      ],
      confidence: createHistoryConfidence('VERY_HIGH', 0.95, ['Discovery engine detection']),
      relatedEventIds,
      importance: 'HIGH',
    };
  }
}
