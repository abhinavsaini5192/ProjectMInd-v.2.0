import type { ContextQuality } from '../models/ContextQuality.js';
import type { ContextCandidate } from '../models/ContextCandidate.js';
import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';

export class ContextQualityEvaluator {
  public evaluate(
    selectedCandidates: readonly ContextCandidate[],
    task: TaskUnderstanding,
    budgetLimit: number,
    freshnessState: string = 'FRESH'
  ): ContextQuality {
    if (selectedCandidates.length === 0) {
      return {
        relevance: 0.1,
        completeness: 0.1,
        freshness: 1.0,
        confidence: 0.5,
        scopeCorrectness: 1.0,
        tokenEfficiency: 1.0,
        explainability: 1.0,
        overallScore: 0.3,
        assessmentReasons: {
          empty: 'No candidates were selected for the given context request.',
        },
      };
    }

    // 1. Relevance: mean score of chosen items
    const avgScore =
      selectedCandidates.reduce((acc, c) => acc + c.score, 0) / selectedCandidates.length;
    const relevance = Math.round(avgScore * 100) / 100;

    // 2. Completeness: features covered
    const featuresPresent = selectedCandidates.some((c) => c.candidateType === 'FEATURE');
    const filesPresent = selectedCandidates.some((c) => c.candidateType === 'FILE');
    let completeness = 0.5;
    if (featuresPresent && filesPresent) completeness = 0.95;
    else if (featuresPresent || filesPresent) completeness = 0.75;

    // 3. Freshness
    const freshness =
      freshnessState === 'FRESH' || freshnessState === 'CURRENT'
        ? 1.0
        : freshnessState === 'RECENT'
          ? 0.85
          : freshnessState === 'STALE'
            ? 0.6
            : 0.2;

    // 4. Confidence
    const avgConfidence =
      selectedCandidates.reduce((acc, c) => acc + c.dimensions.confidence, 0) /
      selectedCandidates.length;
    const confidence = Math.round(avgConfidence * 100) / 100;

    // 5. Scope Correctness
    const scopeCorrectness = 1.0;

    // 6. Token Efficiency: optimal utilization without overflow
    const totalTokens = selectedCandidates.reduce((acc, c) => acc + c.estimatedTokens, 0);
    const tokenEfficiency = totalTokens <= budgetLimit ? 0.95 : 0.5;

    // 7. Explainability
    const explainableCount = selectedCandidates.filter((c) => Boolean(c.primaryEvidence)).length;
    const explainability = Math.round((explainableCount / selectedCandidates.length) * 100) / 100;

    // Composite score
    const overallScore = Math.round(
      (relevance * 0.3 +
        completeness * 0.2 +
        freshness * 0.15 +
        confidence * 0.15 +
        scopeCorrectness * 0.1 +
        tokenEfficiency * 0.05 +
        explainability * 0.05) *
        100
    ) / 100;

    return {
      relevance,
      completeness,
      freshness,
      confidence,
      scopeCorrectness,
      tokenEfficiency,
      explainability,
      overallScore,
      assessmentReasons: {
        relevance: `Average candidate relevance score is ${relevance}`,
        completeness: `Context package covers ${featuresPresent ? 'features' : ''} ${filesPresent ? 'implementation files' : ''}`,
        freshness: `Freshness state is ${freshnessState}`,
        confidence: `Model confidence is ${confidence}`,
      },
    };
  }
}
