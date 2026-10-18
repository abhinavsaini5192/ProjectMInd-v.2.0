import type { ResourceScope } from '../models/ResourceScope.js';
import { isScopeContainedWithin, formatScope } from '../models/ResourceScope.js';

export class CrossScopeViolationError extends Error {
  constructor(
    public readonly operation: string,
    public readonly requestedScope: ResourceScope,
    public readonly authorizedScope: ResourceScope,
    public readonly violationType: 'CROSS_WORKSPACE' | 'CROSS_REPOSITORY' | 'SCOPE_MISMATCH'
  ) {
    super(
      `Cross-scope violation during '${operation}': requested scope '${formatScope(
        requestedScope
      )}' violates authorized scope '${formatScope(authorizedScope)}' [${violationType}]`
    );
    this.name = 'CrossScopeViolationError';
  }
}

export class CrossScopeGuard {
  /**
   * Asserts that requested target scope strictly falls within the caller's authorized scope.
   * Throws CrossScopeViolationError if cross-workspace or cross-repository access is attempted.
   */
  public static assertScopeAccess(
    authorizedScope: ResourceScope,
    requestedScope: ResourceScope,
    operationName: string
  ): void {
    if (authorizedScope.global) {
      return; // Platform global admin
    }

    // 1. Workspace Isolation
    if (authorizedScope.workspaceId !== undefined) {
      if (!requestedScope.workspaceId || requestedScope.workspaceId !== authorizedScope.workspaceId) {
        throw new CrossScopeViolationError(
          operationName,
          requestedScope,
          authorizedScope,
          'CROSS_WORKSPACE'
        );
      }
    }

    // 2. Repository Isolation
    if (authorizedScope.repositoryId !== undefined) {
      if (!requestedScope.repositoryId || requestedScope.repositoryId !== authorizedScope.repositoryId) {
        throw new CrossScopeViolationError(
          operationName,
          requestedScope,
          authorizedScope,
          'CROSS_REPOSITORY'
        );
      }
    }

    // 3. Hierarchical Containment check
    if (!isScopeContainedWithin(requestedScope, authorizedScope)) {
      throw new CrossScopeViolationError(
        operationName,
        requestedScope,
        authorizedScope,
        'SCOPE_MISMATCH'
      );
    }
  }

  /**
   * Verifies that a cache key or prefix includes the authorized workspace scope to prevent cross-tenant cache pollution.
   */
  public static validateCacheKey(authorizedScope: ResourceScope, cacheKey: string): boolean {
    if (authorizedScope.global) return true;
    if (!authorizedScope.workspaceId) return true;

    // Cache key must be namespaced with the workspace identifier
    const expectedPrefix = `ws:${authorizedScope.workspaceId}:`;
    return cacheKey.startsWith(expectedPrefix);
  }

  /**
   * Builds a canonical, isolated cache key prefixed with scope boundaries.
   */
  public static buildScopedCacheKey(scope: ResourceScope, rawKey: string): string {
    const ws = scope.workspaceId ?? 'global';
    const repo = scope.repositoryId ? `repo:${scope.repositoryId}:` : '';
    return `ws:${ws}:${repo}${rawKey}`;
  }
}
