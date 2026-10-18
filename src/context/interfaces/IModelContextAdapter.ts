import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';

export interface IModelContextAdapter {
  readonly format: ContextFormat;
  formatContext(request: ContextAdapterRequest): ContextAdapterResponse;
}
