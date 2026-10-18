import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationType } from '../models/ObservationType.js';

export interface ObservationClassificationResult {
  readonly type: ObservationType;
  readonly category: string;
  readonly affectedResources: readonly string[];
  readonly affectedTaskState?: string | undefined;
  readonly isProjectRelevant: boolean;
  readonly triggersContextInvalidation: boolean;
}

export interface IObservationClassifier {
  classify(observation: ExecutionObservation): ObservationClassificationResult;
}
