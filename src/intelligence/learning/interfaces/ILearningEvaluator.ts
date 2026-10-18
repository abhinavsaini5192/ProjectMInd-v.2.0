import type { LearningCandidate } from '../models/LearningCandidate.js';
import type { LearningEvaluation, ShadowComparisonResult } from '../models/LearningEvaluation.js';

export interface EvaluationOptions {
  readonly evaluatorId?: string | undefined;
  readonly baselineMetrics?: Record<string, number> | undefined;
}

export interface ILearningEvaluator {
  evaluateCandidate(candidate: LearningCandidate, options?: EvaluationOptions): Promise<LearningEvaluation>;
  evaluateShadow(candidate: LearningCandidate, baselineMetrics: Record<string, number>): Promise<ShadowComparisonResult>;
}
