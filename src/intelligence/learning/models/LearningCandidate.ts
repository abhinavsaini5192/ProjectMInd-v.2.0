import type { LearningScopeRef } from './LearningScope.js';
import type { LearningEvidence } from './LearningSignal.js';
import type { LearningAuthority } from './LearningAuthority.js';

export type CandidateTargetSystem =
  | 'CONTEXT'
  | 'RETRIEVAL'
  | 'PLANNING'
  | 'COLLABORATION'
  | 'MEMORY'
  | 'FEATURE';

export type CandidateRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CandidateReversibility = 'FULL' | 'PARTIAL' | 'IRREVERSIBLE';

export type CandidateEvaluationStatus =
  | 'PROPOSED'
  | 'EVALUATING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DEPLOYED'
  | 'ROLLED_BACK'
  | 'SUPERSEDED'
  | 'EXPIRED';

export type CandidateDeploymentMode = 'SHADOW' | 'ACTIVE' | 'DISABLED';

export interface CandidateTarget {
  readonly system: CandidateTargetSystem;
  readonly targetType: string;
  readonly targetId: string;
  readonly parameterKey?: string | undefined;
}

export interface LearningCandidate {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly candidateType: string;
  readonly target: CandidateTarget;
  readonly proposedChange: Record<string, any>;
  readonly scope: LearningScopeRef;
  readonly evidence: readonly LearningEvidence[];
  readonly confidence: number;
  readonly authority: LearningAuthority;
  readonly expectedEffect: string;
  readonly risk: CandidateRiskLevel;
  readonly reversibility: CandidateReversibility;
  readonly evaluationStatus: CandidateEvaluationStatus;
  readonly deploymentMode: CandidateDeploymentMode;
  readonly reasoning: readonly string[];
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly validFrom?: number | undefined;
  readonly validUntil?: number | undefined;
  readonly supersededBy?: string | undefined;
  readonly metadata?: Record<string, any> | undefined;
}
