export interface RelevanceBreakdown {
  directness: number;        // 0 to 1: directly requested / changed vs inferred
  taskAlignment: number;     // 0 to 1: textual/intent match
  roleImportance: number;    // 0 to 1: primary/entry-point vs supporting
  flowParticipation: number; // 0 to 1: participates in primary flow
  criticality: number;       // 0 to 1: health/criticality score
}

export interface ContextRelevance {
  score: number;             // overall aggregate score: 0 to 1
  confidence: number;        // evidence trustworthiness: 0 to 1
  importance: number;        // architectural weight: 0 to 1
  directness: boolean;       // directly matched vs dependency/indirect
  reasons: string[];         // explicit evidence justifications
  breakdown?: RelevanceBreakdown | undefined;
}

export function createDefaultRelevance(
  score = 0.5,
  confidence = 1.0,
  directness = false,
  reasons: string[] = []
): ContextRelevance {
  return {
    score: Math.max(0, Math.min(1, score)),
    confidence: Math.max(0, Math.min(1, confidence)),
    importance: Math.max(0, Math.min(1, score)),
    directness,
    reasons,
  };
}
