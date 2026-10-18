import type { KnowledgeArea } from './KnowledgeArea.js';
import type { KnowledgeUpdateReference } from './KnowledgeUpdateReference.js';

export type KnowledgeConflictType =
  | 'SOURCE_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'VERIFICATION_CONFLICT'
  | 'RESOURCE_CONFLICT'
  | 'FEATURE_CONFLICT'
  | 'DEPENDENCY_CONFLICT'
  | 'BEHAVIOR_CONFLICT'
  | 'TIMELINE_CONFLICT'
  | 'SCOPE_CONFLICT'
  | 'UNKNOWN';

export interface KnowledgeUpdateConflict {
  readonly conflictId: string;
  readonly updateId: string;
  readonly conflictType: KnowledgeConflictType;
  readonly conflictingSources: readonly string[];
  readonly evidence: readonly KnowledgeUpdateReference[];
  readonly affectedKnowledgeAreas: readonly KnowledgeArea[];
  readonly confidence: number;
  readonly resolutionStatus: 'UNRESOLVED' | 'RESOLVED_PRECEDENCE' | 'MANUAL_INTERVENTION_REQUIRED';
  readonly resolutionRationale?: string | undefined;
  readonly detectedAt: number;
}
