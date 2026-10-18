export interface SelectionExplanation {
  targetId: string;
  targetType: 'FEATURE' | 'RESOURCE' | 'SECTION' | 'TEST' | 'RISK';
  reason: string;
  score: number;
  subsystemSource: string;
}

export interface ContextExplanation {
  taskAnalysisSummary: string;
  featureSelectionReasons: Record<string, string>;
  resourceSelectionReasons: Record<string, string>;
  omissionReasons: Record<string, string>;
  detailedExplanations: SelectionExplanation[];
}
