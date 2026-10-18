import type { AgentContextSession } from '../models/AgentContextSession.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { AgentChangeSet } from '../models/AgentChangeSet.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';

export type InvalidationDecision =
  | 'NO_REFRESH_REQUIRED'
  | 'PARTIAL_REFRESH_REQUIRED'
  | 'FULL_REFRESH_REQUIRED'
  | 'REFRESH_DEFERRED'
  | 'INSUFFICIENT_INFORMATION';

export interface InvalidationEvaluationResult {
  readonly decision: InvalidationDecision;
  readonly affectedFeatures: readonly string[];
  readonly affectedResources: readonly string[];
  readonly staleSections: readonly string[];
  readonly reason: ContextRefreshReason;
  readonly summary: string;
}

export interface IAgentContextInvalidator {
  evaluateInvalidation(
    session: AgentContextSession,
    state: AgentContextState,
    changeSet: AgentChangeSet,
    pinnedFeatureIds?: readonly string[] | undefined,
    pinnedResourceIds?: readonly string[] | undefined
  ): Promise<InvalidationEvaluationResult>;
}
