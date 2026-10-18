import type { ScopeLevel } from './LearningScope.js';
import type { CandidateRiskLevel } from './LearningCandidate.js';

export interface LearningPolicy {
  readonly policyId: string;
  readonly scopeLevel: ScopeLevel;
  readonly minConfidence: number; // e.g. 0.6 for project, 0.9 for global
  readonly minEvidenceCount: number; // e.g. 3 for project, 10 for global
  readonly minSourceDiversity: number; // min distinct sources
  readonly maxAllowedRisk: CandidateRiskLevel;
  readonly requireExplicitApproval: boolean; // global requires true
  readonly allowAutomaticDeployment: boolean;
  readonly maxAdjustmentMagnitude: number; // clamping max e.g. 0.25
  readonly cooldownPeriodMs: number; // minimum time before re-adjusting same target
}

export const DEFAULT_RESOURCE_POLICY: LearningPolicy = {
  policyId: 'policy-resource-default',
  scopeLevel: 'RESOURCE',
  minConfidence: 0.5,
  minEvidenceCount: 2,
  minSourceDiversity: 1,
  maxAllowedRisk: 'MEDIUM',
  requireExplicitApproval: false,
  allowAutomaticDeployment: true,
  maxAdjustmentMagnitude: 0.35,
  cooldownPeriodMs: 60_000,
};

export const DEFAULT_PROJECT_POLICY: LearningPolicy = {
  policyId: 'policy-project-default',
  scopeLevel: 'PROJECT',
  minConfidence: 0.7,
  minEvidenceCount: 3,
  minSourceDiversity: 2,
  maxAllowedRisk: 'MEDIUM',
  requireExplicitApproval: false,
  allowAutomaticDeployment: true,
  maxAdjustmentMagnitude: 0.25,
  cooldownPeriodMs: 300_000,
};

export const DEFAULT_GLOBAL_POLICY: LearningPolicy = {
  policyId: 'policy-global-default',
  scopeLevel: 'GLOBAL',
  minConfidence: 0.9,
  minEvidenceCount: 10,
  minSourceDiversity: 5,
  maxAllowedRisk: 'LOW',
  requireExplicitApproval: true, // MUST be approved explicitly by human
  allowAutomaticDeployment: false,
  maxAdjustmentMagnitude: 0.15,
  cooldownPeriodMs: 3_600_000,
};
