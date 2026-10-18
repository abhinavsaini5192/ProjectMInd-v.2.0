import type { LearningScopeRef } from './LearningScope.js';
import type { LearningAuthority } from './LearningAuthority.js';

export type SignalDirection =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'INCREASE'
  | 'DECREASE'
  | 'NO_CHANGE'
  | 'UNKNOWN';

export type LearningSignalType =
  | 'RESOURCE_RELEVANCE'
  | 'RESOURCE_OMISSION'
  | 'RETRIEVAL_RANKING_ADJUSTMENT'
  | 'TASK_DECOMPOSITION_HEURISTIC'
  | 'TASK_PRIORITY_ADJUSTMENT'
  | 'AGENT_ROLE_AFFINITY'
  | 'VERIFICATION_REQUIREMENT'
  | 'FEATURE_RESOURCE_ASSOCIATION'
  | 'MEMORY_UTILITY'
  | 'MEMORY_STALENESS'
  | 'GENERAL_CORRECTION';

export interface LearningEvidence {
  readonly evidenceId: string;
  readonly feedbackId?: string | undefined;
  readonly sourceType: string;
  readonly description: string;
  readonly value: number;
  readonly confidence: number;
  readonly timestamp: number;
  readonly authority: LearningAuthority;
  readonly referenceUri?: string | undefined;
  readonly verificationPassed?: boolean | undefined;
}

export interface LearningTarget {
  readonly targetType: string;
  readonly targetId: string;
  readonly name?: string | undefined;
}

export interface SignalProvenance {
  readonly feedbackCount: number;
  readonly uniqueSources: readonly string[];
  readonly dominantAuthority: LearningAuthority;
  readonly isAggregated: boolean;
  readonly generatedBy: string;
}

export interface LearningSignal {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly type: LearningSignalType;
  readonly target: LearningTarget;
  readonly scope: LearningScopeRef;
  readonly direction: SignalDirection;
  readonly magnitude: number; // [0.0 to 1.0]
  readonly confidence: number; // [0.0 to 1.0]
  readonly evidence: readonly LearningEvidence[];
  readonly provenance: SignalProvenance;
  readonly createdAt: number;
  readonly metadata?: Record<string, any> | undefined;
}
