import type { CandidateTargetSystem } from './LearningCandidate.js';

export type ImpactCertainty = 'OBSERVED' | 'CORRELATED' | 'SUPPORTED' | 'UNKNOWN';

export interface LearningImpact {
  readonly id: string;
  readonly deployedLearningId: string;
  readonly targetSystem: CandidateTargetSystem;
  readonly impactType: ImpactCertainty;
  readonly metricName: string;
  readonly baselineValue: number;
  readonly currentValue: number;
  readonly delta: number;
  readonly sampleCount: number;
  readonly measuredAt: number;
  readonly explanation: string;
}
