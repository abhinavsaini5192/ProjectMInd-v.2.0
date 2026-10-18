import type { ContextRequest } from '../models/ContextRequest.js';
import { DEFAULT_CONTEXT_BUDGET } from '../models/ContextBudget.js';

export class ContextRequestResolver {
  public static resolve(request: ContextRequest): ContextRequest {
    const tokenBudget = request.tokenBudget ?? DEFAULT_CONTEXT_BUDGET.totalBudget;
    const compactMode = request.compactMode ?? tokenBudget < 2000;

    return {
      ...request,
      tokenBudget,
      maxDepth: request.maxDepth ?? 1,
      outputFormat: request.outputFormat ?? 'generic-markdown',
      freshnessPolicy: request.freshnessPolicy ?? 'CURRENT',
      compactMode,
    };
  }
}
