import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistorySourceType } from '../models/FeatureHistorySource.js';

export interface FeatureHistorySourceContext {
  featureId: string;
  workspaceId?: string | undefined;
  repositoryId?: string | undefined;
  sinceTimestamp?: number | undefined;
  untilTimestamp?: number | undefined;
  knowledgeVersion?: string | undefined;
}

export interface IFeatureHistorySource {
  readonly sourceType: FeatureHistorySourceType;
  fetchEvents(context: FeatureHistorySourceContext): Promise<FeatureHistoryEvent[]>;
}
