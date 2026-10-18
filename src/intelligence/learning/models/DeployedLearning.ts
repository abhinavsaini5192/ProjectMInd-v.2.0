import type { CandidateTarget } from './LearningCandidate.js';
import type { LearningScopeRef } from './LearningScope.js';

export type DeployedLearningStatus = 'ACTIVE' | 'SUPERSEDED' | 'ROLLED_BACK' | 'DISABLED';

export interface DeployedLearning {
  readonly id: string;
  readonly candidateId: string;
  readonly version: number;
  readonly target: CandidateTarget;
  readonly appliedChange: Record<string, any>;
  readonly scope: LearningScopeRef;
  readonly deployedAt: number;
  readonly deployedBy: string;
  readonly status: DeployedLearningStatus;
  readonly previousVersionId?: string | undefined;
  readonly rollbackId?: string | undefined;
  readonly evaluationId: string;
  readonly metadata?: Record<string, any> | undefined;
}
