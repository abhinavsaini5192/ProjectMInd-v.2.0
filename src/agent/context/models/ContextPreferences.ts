export interface ContextPreferences {
  readonly includeTests?: boolean | undefined;
  readonly includeHistory?: boolean | undefined;
  readonly includeRisks?: boolean | undefined;
  readonly includeDependencies?: boolean | undefined;
  readonly compactMode?: boolean | undefined;
  readonly tokenBudget?: number | undefined;
  readonly maxDepth?: number | undefined;
  readonly maxFeatures?: number | undefined;
  readonly maxResources?: number | undefined;
}

export const DEFAULT_CONTEXT_PREFERENCES: Readonly<ContextPreferences> = {
  includeTests: true,
  includeHistory: false,
  includeRisks: true,
  includeDependencies: true,
  compactMode: false,
  tokenBudget: 8000,
  maxDepth: 2,
};
