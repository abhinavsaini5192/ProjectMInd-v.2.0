import type { ContextPackage } from '../models/ContextPackage.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import { ContextValidationError } from '../errors/ContextValidationError.js';
import { ScopeViolationError } from '../../security/errors/SecurityError.js';

export class ContextValidator {
  public validate(pkg: ContextPackage, request: ContextRequest): void {
    if (!pkg.packageId) {
      throw new ContextValidationError('ContextPackage must have a valid packageId');
    }

    // 1. Enforce Workspace Scope Isolation
    const sec = request.securityContext;
    if (sec && !sec.isGlobalAdmin?.()) {
      if (sec.workspaceId && sec.workspaceId !== '*' && sec.workspaceId !== request.workspaceId) {
        throw new ScopeViolationError(
          `Cross-workspace violation: Context requested for workspace '${request.workspaceId}', but caller authorized only for '${sec.workspaceId}'`
        );
      }

      // Enforce Project Scope Isolation
      const reqProjectId = request.projectId ?? request.projectContext?.projectId;
      if (sec.projectId && sec.projectId !== '*' && reqProjectId && sec.projectId !== reqProjectId) {
        throw new ScopeViolationError(
          `Cross-project violation: Context requested for project '${reqProjectId}', but caller authorized only for '${sec.projectId}'`
        );
      }
    }

    // 2. Budget Enforcement
    const budgetLimit = request.tokenBudget ?? 8000;
    if (pkg.estimatedTokens > budgetLimit * 1.1) {
      throw new ContextValidationError(
        `Context package estimated tokens (${pkg.estimatedTokens}) exceeded configured budget limit (${budgetLimit})`,
        'CONTEXT_BUDGET_EXCEEDED'
      );
    }

    // 3. Duplicate checks in returned resources
    const resourceIds = new Set<string>();
    for (const res of pkg.resources ?? []) {
      if (resourceIds.has(res.resourceId)) {
        pkg.warnings.push({
          type: 'DUPLICATE_RESOURCE',
          message: `Duplicate resource '${res.resourceId}' detected in package`,
          section: 'RESOURCES',
        });
      }
      resourceIds.add(res.resourceId);
    }
  }
}
