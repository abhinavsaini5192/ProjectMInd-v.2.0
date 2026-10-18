export interface LearningQualityDimensions {
  readonly evidenceQuality: number; // [0.0 to 1.0]
  readonly sourceDiversity: number; // [0.0 to 1.0]
  readonly consistency: number; // [0.0 to 1.0]
  readonly recency: number; // [0.0 to 1.0]
  readonly scopePrecision: number; // [0.0 to 1.0]
  readonly reversibility: number; // [0.0 to 1.0]
  readonly outcomeSupport: number; // [0.0 to 1.0]
  readonly conflictLevel: number; // [0.0 to 1.0] (0 is no conflict, 1 is high conflict)
}

export type EvaluationRecommendedAction =
  | 'ACCEPT'
  | 'REJECT'
  | 'SHADOW_TEST'
  | 'REQUIRE_HUMAN_APPROVAL';

export interface ShadowComparisonResult {
  readonly controlMetric: number;
  readonly candidateMetric: number;
  readonly relativeImprovement: number;
  readonly sampleCount: number;
  readonly notes: string;
}

export interface LearningEvaluation {
  readonly evaluationId: string;
  readonly candidateId: string;
  readonly dimensions: LearningQualityDimensions;
  readonly overallScore: number; // [0.0 to 1.0]
  readonly isAccepted: boolean;
  readonly recommendedAction: EvaluationRecommendedAction;
  readonly risksIdentified: readonly string[];
  readonly conflictsDetected: readonly string[];
  readonly shadowComparison?: ShadowComparisonResult | undefined;
  readonly evaluatedAt: number;
  readonly evaluator: string;
  readonly explanation: string;
}
