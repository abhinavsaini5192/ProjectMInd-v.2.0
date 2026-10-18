import type {
  IFeatureEvolutionBuilder,
  EvolutionBuilderOptions,
} from '../interfaces/IFeatureEvolutionBuilder.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureEvolutionEvent } from '../models/FeatureEvolutionEvent.js';
import type { FeatureEvolutionType } from '../models/FeatureEvolutionType.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureEvolutionBuilder implements IFeatureEvolutionBuilder {
  private readonly defaultWindowMs: number = 5 * 60 * 1000; // 5 minutes

  public buildEvolutionEvents(
    featureId: string,
    rawEvents: FeatureHistoryEvent[],
    options: EvolutionBuilderOptions = {}
  ): FeatureEvolutionEvent[] {
    if (rawEvents.length === 0) {
      return [];
    }

    const windowMs = options.episodeWindowMs ?? this.defaultWindowMs;

    // Sort events by timestamp
    const sorted = [...rawEvents].sort((a, b) => a.timestamp - b.timestamp);

    // Group events into episodes based on knowledgeVersion and/or timestamp closeness
    const episodes: FeatureHistoryEvent[][] = [];
    let currentEpisode: FeatureHistoryEvent[] = [];

    for (const ev of sorted) {
      if (currentEpisode.length === 0) {
        currentEpisode.push(ev);
        continue;
      }

      const prev = currentEpisode[currentEpisode.length - 1];
      if (!prev) {
        currentEpisode.push(ev);
        continue;
      }

      const sameVersion = Boolean(
        prev.knowledgeVersion &&
          ev.knowledgeVersion &&
          prev.knowledgeVersion === ev.knowledgeVersion
      );
      const closeInTime = Math.abs(ev.timestamp - prev.timestamp) <= windowMs;

      if (sameVersion || closeInTime) {
        currentEpisode.push(ev);
      } else {
        episodes.push(currentEpisode);
        currentEpisode = [ev];
      }
    }

    if (currentEpisode.length > 0) {
      episodes.push(currentEpisode);
    }

    // Convert each episode into a FeatureEvolutionEvent
    const evolutionEvents: FeatureEvolutionEvent[] = [];

    for (let i = 0; i < episodes.length; i++) {
      const group = episodes[i];
      if (!group || group.length === 0) continue;

      const firstEv = group[0];
      if (!firstEv) continue;

      const isSemantic = group.some(
        (e) => e.eventType !== 'TECHNICAL_CHANGE' && e.evolutionType !== 'TECHNICAL'
      );

      const primaryType = this.resolvePrimaryEvolutionType(group);
      const changedDims = Array.from(new Set(group.flatMap((e) => e.changedDimensions)));
      const evidence = group.flatMap((e) => e.evidence);

      // Average confidence score
      const avgScore =
        group.reduce((acc, e) => acc + e.confidence.score, 0) / group.length;
      const confLevel =
        avgScore >= 0.85
          ? 'VERY_HIGH'
          : avgScore >= 0.7
            ? 'HIGH'
            : avgScore >= 0.4
              ? 'MEDIUM'
              : 'LOW';

      const title = this.generateEpisodeTitle(featureId, primaryType, group, isSemantic);
      const description = this.generateEpisodeDescription(primaryType, group, changedDims);

      evolutionEvents.push({
        evolutionId: `evo_${featureId}_${i}_${firstEv.timestamp}`,
        featureId,
        groupId: `grp_${firstEv.timestamp}`,
        primaryEvolutionType: primaryType,
        sourceEvents: group,
        changedDimensions: changedDims,
        title,
        description,
        timestamp: firstEv.timestamp,
        confidence: createHistoryConfidence(
          confLevel,
          avgScore,
          group.flatMap((e) => e.confidence.reasons)
        ),
        evidence,
        isSemantic,
      });
    }

    return evolutionEvents;
  }

  private resolvePrimaryEvolutionType(events: FeatureHistoryEvent[]): FeatureEvolutionType {
    // Check if any creation / discovery
    if (events.some((e) => e.eventType === 'FEATURE_CREATED')) return 'CREATION';
    if (events.some((e) => e.eventType === 'FEATURE_DISCOVERED')) return 'DISCOVERY';
    if (events.some((e) => e.eventType === 'FEATURE_DEPRECATED')) return 'DEPRECATION';
    if (events.some((e) => e.eventType === 'FEATURE_STABILIZED')) return 'STABILIZATION';
    if (events.some((e) => e.eventType === 'FEATURE_REGRESSION_DETECTED')) return 'REGRESSION';

    // Count evolution types
    const counts = new Map<FeatureEvolutionType, number>();
    for (const ev of events) {
      const t = ev.evolutionType;
      counts.set(t, (counts.get(t) || 0) + 1);
    }

    // Return highest count, default STRUCTURAL or UNKNOWN
    let maxType: FeatureEvolutionType = 'STRUCTURAL';
    let maxCount = -1;
    for (const [t, cnt] of counts.entries()) {
      if (t !== 'TECHNICAL' && cnt > maxCount) {
        maxCount = cnt;
        maxType = t;
      }
    }

    if (maxCount <= 0) {
      return events.some((e) => e.evolutionType === 'TECHNICAL') ? 'TECHNICAL' : 'UNKNOWN';
    }

    return maxType;
  }

  private generateEpisodeTitle(
    featureId: string,
    type: FeatureEvolutionType,
    events: FeatureHistoryEvent[],
    isSemantic: boolean
  ): string {
    if (!isSemantic) {
      return `Technical update on ${featureId}`;
    }

    switch (type) {
      case 'CREATION':
        return `Initial creation of ${featureId}`;
      case 'DISCOVERY':
        return `Discovery of ${featureId}`;
      case 'STRUCTURAL':
        return `Structural and mapping update on ${featureId}`;
      case 'BEHAVIORAL':
        return `Behavioral flow update on ${featureId}`;
      case 'DEPENDENCY':
        return `Dependency topology change for ${featureId}`;
      case 'HEALTH':
        return `Health and verification update for ${featureId}`;
      case 'RISK':
        return `Risk profile shift on ${featureId}`;
      case 'DEPRECATION':
        return `Deprecation of ${featureId}`;
      case 'STABILIZATION':
        return `Stabilization of ${featureId}`;
      case 'REGRESSION':
        return `Regression detected in ${featureId}`;
      default:
        return `Evolution event for ${featureId} (${type})`;
    }
  }

  private generateEpisodeDescription(
    type: FeatureEvolutionType,
    events: FeatureHistoryEvent[],
    changedDimensions: string[]
  ): string {
    const eventCount = events.length;
    const dims = changedDimensions.join(', ') || 'none';
    return `Episode comprising ${eventCount} correlated event(s) across dimensions [${dims}]. Primary focus: ${type}.`;
  }
}
