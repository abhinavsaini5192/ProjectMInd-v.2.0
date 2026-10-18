import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureEvolutionEvent } from '../models/FeatureEvolutionEvent.js';
import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import type { FeatureTimeline } from '../models/FeatureTimeline.js';

export interface IFeatureTimelineAggregator {
  aggregateTimeline(
    featureId: string,
    events: FeatureHistoryEvent[],
    evolutionEvents: FeatureEvolutionEvent[],
    milestones: FeatureMilestone[]
  ): FeatureTimeline;
}
