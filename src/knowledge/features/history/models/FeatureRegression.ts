import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export type RegressionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RegressionEvidence {
  type: string;
  description: string;
  source?: string | undefined;
}

export interface FeatureRegression {
  regressionId: string;
  featureId: string;
  regressionType: string;
  description: string;
  severity: RegressionSeverity;
  evidence: RegressionEvidence[];
  confidence: FeatureHistoryConfidence;
  detectedAt: number;
  previousState?: Record<string, any> | undefined;
  currentState?: Record<string, any> | undefined;
}
