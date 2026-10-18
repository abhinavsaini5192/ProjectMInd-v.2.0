import type { ResourceScope } from '../models/ResourceScope.js';
import { isScopeContainedWithin } from '../models/ResourceScope.js';
import { ScopeViolationError } from '../errors/SecurityError.js';

export class ScopePolicy {
  /**
   * Asserts that the request scope is strictly within authorized scope.
   * Throws ScopeViolationError if cross-workspace or cross-repository access is attempted.
   */
  public static assertScopeContained(
    requestScope: ResourceScope,
    authorizedScope: ResourceScope,
    principalId?: string
  ): void {
    if (!isScopeContainedWithin(requestScope, authorizedScope)) {
      throw new ScopeViolationError(
        `Cross-scope access denied: request for workspace='${requestScope.workspaceId ?? 'any'}', repo='${requestScope.repositoryId ?? 'any'}' is outside authorized scope (ws='${authorizedScope.workspaceId ?? 'global'}', repo='${authorizedScope.repositoryId ?? 'all'}')`,
        {
          principalId,
          scope: { requestScope, authorizedScope },
        }
      );
    }
  }

  /**
   * Deterministic boolean check whether request scope is authorized.
   */
  public static isScopeAllowed(
    requestScope: ResourceScope,
    authorizedScope: ResourceScope
  ): boolean {
    return isScopeContainedWithin(requestScope, authorizedScope);
  }
}
