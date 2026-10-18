import type { IScopeValidator } from '../interfaces/IScopeValidator.js';
import type { ResourceScope } from '../models/ResourceScope.js';
import { isScopeContainedWithin } from '../models/ResourceScope.js';
import { ScopeViolationError } from '../errors/SecurityError.js';
import type { IEventBus } from '../../events/index.js';
import { SECURITY_EVENTS } from '../events/SecurityEvents.js';

export class ScopeValidator implements IScopeValidator {
  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public validateScope(requestScope: ResourceScope, authorizedScope: ResourceScope): void {
    if (!this.isScopeAllowed(requestScope, authorizedScope)) {
      const isCrossWorkspace =
        authorizedScope.workspaceId !== undefined &&
        requestScope.workspaceId !== undefined &&
        requestScope.workspaceId !== authorizedScope.workspaceId;

      const isCrossProject =
        authorizedScope.projectId !== undefined &&
        requestScope.projectId !== undefined &&
        requestScope.projectId !== authorizedScope.projectId;

      const isCrossRepository =
        authorizedScope.repositoryId !== undefined &&
        requestScope.repositoryId !== undefined &&
        requestScope.repositoryId !== authorizedScope.repositoryId;

      const violationType = isCrossWorkspace
        ? 'CROSS_WORKSPACE_ACCESS'
        : isCrossProject
        ? 'CROSS_PROJECT_ACCESS'
        : isCrossRepository
        ? 'CROSS_REPOSITORY_ACCESS'
        : 'POLICY_VIOLATION';

      if (this.eventBus) {
        this.eventBus.publish(SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED, {
          violationType,
          targetScope: requestScope,
          details: {
            authorizedScope,
            requestScope,
          },
          timestamp: new Date().toISOString(),
        });
      }

      throw new ScopeViolationError(
        `Scope violation: Target scope (ws='${requestScope.workspaceId ?? 'none'}', proj='${requestScope.projectId ?? 'none'}', repo='${requestScope.repositoryId ?? 'none'}') is outside authorized scope (ws='${authorizedScope.workspaceId ?? 'global'}', proj='${authorizedScope.projectId ?? 'all'}', repo='${authorizedScope.repositoryId ?? 'all'}')`,
        { scope: { requestScope, authorizedScope } }
      );
    }
  }

  public isScopeAllowed(requestScope: ResourceScope, authorizedScope: ResourceScope): boolean {
    return isScopeContainedWithin(requestScope, authorizedScope);
  }
}
