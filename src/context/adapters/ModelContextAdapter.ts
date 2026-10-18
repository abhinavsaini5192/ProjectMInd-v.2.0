import type { IModelContextAdapter } from '../interfaces/IModelContextAdapter.js';
import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { TokenEstimator } from '../budgeting/TokenEstimator.js';

export abstract class ModelContextAdapter implements IModelContextAdapter {
  public abstract readonly format: ContextFormat;

  public abstract formatContext(request: ContextAdapterRequest): ContextAdapterResponse;

  protected estimateTokens(text: string): number {
    return TokenEstimator.estimate(text);
  }
}
