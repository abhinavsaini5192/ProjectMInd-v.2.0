export type FeatureHistoryConfidenceLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface FeatureHistoryConfidence {
  level: FeatureHistoryConfidenceLevel;
  score: number; // 0 to 1
  reasons: string[];
}

export function createHistoryConfidence(
  level: FeatureHistoryConfidenceLevel,
  score: number,
  reasons: string[] = []
): FeatureHistoryConfidence {
  return {
    level,
    score: Math.max(0, Math.min(1, score)),
    reasons,
  };
}
