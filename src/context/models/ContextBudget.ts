export interface ContextBudget {
  totalBudget: number;
  maxBudget?: number | undefined;
  reservedForPrompt: number;
  reservedForMetadata: number;
  availableForContext: number;
  compactMode?: boolean | undefined;
}

export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  totalBudget: 4000,
  reservedForPrompt: 500,
  reservedForMetadata: 300,
  availableForContext: 3200,
  compactMode: false,
};
