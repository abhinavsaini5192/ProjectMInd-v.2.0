export interface ContextQuality {
  readonly relevance: number;          // Degree to which context directly informs the task
  readonly completeness: number;       // Degree to which all required dependencies/behaviors are covered
  readonly freshness: number;          // Knowledge freshness and synchronization state
  readonly confidence: number;         // Statistical/heuristic confidence across selections
  readonly scopeCorrectness: number;   // 1.0 if strictly within authorized scope, 0.0 otherwise
  readonly tokenEfficiency: number;    // Information density per token
  readonly explainability: number;     // Proportion of selected items with structured evidence
  readonly overallScore: number;       // Composite quality metric (0.0 - 1.0)
  readonly assessmentReasons: Readonly<Record<string, string>>;
}
