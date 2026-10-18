import type { FeatureHistoryEvent } from './FeatureHistoryEvent.js';
import type { FeatureEvolutionEvent } from './FeatureEvolutionEvent.js';
import type { FeatureMilestone } from './FeatureMilestone.js';
import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export interface FeatureTimeline {
  featureId: string;
  events: FeatureHistoryEvent[];
  evolutionEvents: FeatureEvolutionEvent[];
  milestones: FeatureMilestone[];
  startTime: number;
  endTime: number;
  eventCount: number;
  meaningfulEventCount: number;
  confidence: FeatureHistoryConfidence;
  timelineVersion: number;
}
