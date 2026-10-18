import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureEvolutionEvent } from '../models/FeatureEvolutionEvent.js';

export interface EvolutionBuilderOptions {
  episodeWindowMs?: number | undefined;
}

export interface IFeatureEvolutionBuilder {
  buildEvolutionEvents(
    featureId: string,
    rawEvents: FeatureHistoryEvent[],
    options?: EvolutionBuilderOptions
  ): FeatureEvolutionEvent[];
}
