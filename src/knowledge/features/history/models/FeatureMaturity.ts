import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export type FeatureMaturityLevel =
  | 'UNKNOWN'
  | 'NASCENT'
  | 'DEVELOPING'
  | 'ESTABLISHED'
  | 'MATURE'
  | 'DEPRECATED';

export const FEATURE_MATURITY_LEVELS: readonly FeatureMaturityLevel[] = [
  'UNKNOWN',
  'NASCENT',
  'DEVELOPING',
  'ESTABLISHED',
  'MATURE',
  'DEPRECATED',
] as const;

export interface MaturityFactors {
  ageInDays: number;
  stabilityScore: number;
  verificationScore: number;
  mappingConfidence: number;
  dependencyStability: number;
}

export interface FeatureMaturity {
  level: FeatureMaturityLevel;
  score: number; // 0 to 100
  rationale: string;
  factors: MaturityFactors;
  confidence: FeatureHistoryConfidence;
}
