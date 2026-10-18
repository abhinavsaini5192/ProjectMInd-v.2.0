import type {
  IFeatureHistorySource,
  FeatureHistorySourceContext,
} from '../interfaces/IFeatureHistorySource.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistorySourceType } from '../models/FeatureHistorySource.js';

export class HealthHistorySource implements IFeatureHistorySource {
  public readonly sourceType: FeatureHistorySourceType = 'HEALTH';

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
    return this.recordedEvents.filter((e) => e.featureId === context.featureId);
  }
}
