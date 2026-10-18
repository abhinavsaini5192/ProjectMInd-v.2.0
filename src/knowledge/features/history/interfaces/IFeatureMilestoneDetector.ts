import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureMilestone } from '../models/FeatureMilestone.js';

export interface IFeatureMilestoneDetector {
  detectMilestones(
    featureId: string,
    timelineEvents: FeatureHistoryEvent[],
    snapshots: FeatureSnapshot[]
  ): FeatureMilestone[];
}
