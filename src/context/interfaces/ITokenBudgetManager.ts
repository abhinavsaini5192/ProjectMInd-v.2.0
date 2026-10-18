import type { ContextBudget } from '../models/ContextBudget.js';
import type { ContextAllocation } from '../models/ContextAllocation.js';
import type { SelectedContextData } from './IContextSelector.js';
import type { ContextWarning } from '../models/ContextWarning.js';

export interface BudgetedContextResult {
  data: SelectedContextData;
  allocation: ContextAllocation;
  warnings: ContextWarning[];
}

export interface ITokenBudgetManager {
  applyBudget(data: SelectedContextData, budget: ContextBudget): BudgetedContextResult;
  estimateTokens(textOrObj: unknown): number;
}
