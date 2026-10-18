import type {
  IFeatureHistorySource,
  FeatureHistorySourceContext,
} from '../interfaces/IFeatureHistorySource.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistorySourceType } from '../models/FeatureHistorySource.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class DiscoveryHistorySource implements IFeatureHistorySource {
  public readonly sourceType: FeatureHistorySourceType = 'DISCOVERY';

  constructor(private recordedEvents: FeatureHistoryEvent[] = []) {}

  public recordEvent(event: FeatureHistoryEvent): void {
    this.recordedEvents.push(event);
  }

  public setEvents(events: FeatureHistoryEvent[]): void {
    this.recordedEvents = [...events];
  }

  public async fetchEvents(
    context: FeatureHistorySourceContext
  ): Promise<FeatureHistoryEvent[]> {
    const events = this.recordedEvents.filter((e) => e.featureId === context.featureId);
    if (events.length > 0) {
      return events;
    }

    // Default discovery event if featureId matches context
    const now = context.sinceTimestamp || Date.now();
    return [
      {
        eventId: `disc_${context.featureId}_${now}`,
        featureId: context.featureId,
        eventType: 'FEATURE_DISCOVERED',
        evolutionType: 'DISCOVERY',
        timestamp: now,
        source: {
          system: 'DISCOVERY',
          provenance: 'OBSERVED',
          referenceId: context.featureId,
        },
        sourceReference: `discovery:${context.featureId}`,
        changedDimensions: ['identity', 'scope'],
        evidence: [
          {
            type: 'DISCOVERY_RECORD',
            description: `Feature ${context.featureId} discovered in repository`,
            confidence: 0.95,
          },
        ],
        confidence: createHistoryConfidence('VERY_HIGH', 0.95, ['Direct discovery record']),
        knowledgeVersion: context.knowledgeVersion || '1.0.0',
      },
    ];
  }
}
