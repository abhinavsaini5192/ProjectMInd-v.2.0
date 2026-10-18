import type { ObservationSource } from './ObservationSource.js';
import type { ObservationType } from './ObservationType.js';
import type { ObservationProvenance } from './ObservationProvenance.js';
import type { ObservationConfidence } from './ObservationConfidence.js';
import type { ObservationOrderingStatus } from './ObservationOrdering.js';
import type { ObservationRetentionCategory } from './ObservationRetention.js';
import type {
  CommandObservationPayload,
  BuildObservationPayload,
  TestObservationPayload,
  ErrorObservationPayload,
  BlockerObservationPayload,
  AgentDecisionObservationPayload,
  ResourceObservationPayload,
} from './payloads/index.js';

export type ObservationStatus =
  | 'RECEIVED'
  | 'NORMALIZED'
  | 'CLASSIFIED'
  | 'CORRELATED'
  | 'PROCESSED'
  | 'PARTIALLY_PROCESSED'
  | 'FAILED';

export type ObservationPayload =
  | CommandObservationPayload
  | BuildObservationPayload
  | TestObservationPayload
  | ErrorObservationPayload
  | BlockerObservationPayload
  | AgentDecisionObservationPayload
  | ResourceObservationPayload
  | Record<string, unknown>;

export interface ExecutionObservation {
  readonly observationId: string;
  readonly taskId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly source: ObservationSource;
  readonly type: ObservationType;
  readonly status: ObservationStatus;
  readonly timestamp: string;
  readonly payload: ObservationPayload;
  readonly confidence: ObservationConfidence;
  readonly provenance: ObservationProvenance | string;
  readonly orderingStatus: ObservationOrderingStatus;
  readonly retention: ObservationRetentionCategory;
  readonly correlationId?: string | undefined;
  readonly operationId?: string | undefined;
  readonly metadata: Record<string, unknown>;

  // Extended observation properties & convenient aliases
  readonly summary?: string | undefined;
  readonly category?: string | undefined;
  readonly ordering?: ObservationOrderingStatus | undefined;
  readonly observedAt?: string | undefined;
  readonly sequenceNumber?: number | undefined;
  readonly affectedResources?: readonly string[] | undefined;
  readonly parentObservationId?: string | undefined;
  readonly targetTaskState?: string | undefined;
}
