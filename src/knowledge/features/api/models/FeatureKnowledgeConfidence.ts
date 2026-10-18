export type KnowledgeConfidenceLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface FeatureKnowledgeConfidence {
  overallScore: number; // 0 to 1
  level: KnowledgeConfidenceLevel;
  sectionConfidences: Record<string, number>;
  factors: string[];
  limitations: string[];
}

export function createKnowledgeConfidence(
  level: KnowledgeConfidenceLevel,
  overallScore: number,
  sectionConfidences: Record<string, number> = {},
  factors: string[] = [],
  limitations: string[] = []
): FeatureKnowledgeConfidence {
  return {
    level,
    overallScore: Math.max(0, Math.min(1, overallScore)),
    sectionConfidences,
    factors,
    limitations,
  };
}
