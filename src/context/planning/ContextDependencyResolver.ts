import type { ContextRequest } from '../models/ContextRequest.js';

export class ContextDependencyResolver {
  public static readonly DEFAULT_MAX_DEPTH = 1;
  public static readonly ABSOLUTE_MAX_DEPTH = 3;

  public static resolveMaxDepth(request: ContextRequest): number {
    if (request.maxDepth !== undefined) {
      return Math.min(Math.max(0, request.maxDepth), this.ABSOLUTE_MAX_DEPTH);
    }
    return this.DEFAULT_MAX_DEPTH;
  }

  public static shouldTraverseDependencies(request: ContextRequest): boolean {
    return request.includeDependencies !== false && this.resolveMaxDepth(request) > 0;
  }
}
