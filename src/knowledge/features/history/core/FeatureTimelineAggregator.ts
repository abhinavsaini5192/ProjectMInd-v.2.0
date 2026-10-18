import type { IFeatureTimelineAggregator } from '../interfaces/IFeatureTimelineAggregator.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureEvolutionEvent } from '../models/FeatureEvolutionEvent.js';
import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import type { FeatureTimeline } from '../models/FeatureTimeline.js';
import { FeatureHistoryNormalizer } from './FeatureHistoryNormalizer.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureTimelineAggregator implements IFeatureTimelineAggregator {
  public aggregateTimeline(
    featureId: string,
    events: FeatureHistoryEvent[],
    evolutionEvents: FeatureEvolutionEvent[],
    milestones: FeatureMilestone[]
  ): FeatureTimeline {
    const sortedEvents = FeatureHistoryNormalizer.sortEvents(events);
    const sortedEvolutions = [...evolutionEvents].sort((a, b) => a.timestamp - b.timestamp);
    const sortedMilestones = [...milestones].sort((a, b) => a.timestamp - b.timestamp);

    const firstEventTime = sortedEvents[0]?.timestamp ?? Date.now();
    const lastEventTime = sortedEvents[sortedEvents.length - 1]?.timestamp ?? firstEventTime;

    // Count meaningful events (exclude formatting/technical changes)
    const meaningfulEvents = sortedEvents.filter(
      (e) => e.eventType !== 'TECHNICAL_CHANGE' && e.evolutionType !== 'TECHNICAL'
    );

    // Compute average confidence
    let totalScore = 0;
    for (const e of sortedEvents) {
      totalScore += e.confidence.score;
    }
    const avgScore = sortedEvents.length > 0 ? totalScore / sortedEvents.length : 0.5;

    const level =
      avgScore >= 0.85
        ? 'VERY_HIGH'
        : avgScore >= 0.7
          ? 'HIGH'
          : avgScore >= 0.4
            ? 'MEDIUM'
            : 'LOW';

    return {
      featureId,
      events: sortedEvents,
      evolutionEvents: sortedEvolutions,
      milestones: sortedMilestones,
      startTime: firstEventTime,
      endTime: lastEventTime,
      eventCount: sortedEvents.length,
      meaningfulEventCount: meaningfulEvents.length,
      confidence: createHistoryConfidence(level, avgScore, [
        `Timeline computed across ${sortedEvents.length} events (${meaningfulEvents.length} meaningful)`,
      ]),
      timelineVersion: 1,
    };
  }
}
