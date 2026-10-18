import type { AuthorizationRequest } from '../interfaces/IAuthorizer.js';
import type { AuthorizationResult } from '../models/AuthorizationResult.js';
import { createAuthzAllow, createAuthzDeny } from '../models/AuthorizationResult.js';
import { formatPermission } from '../models/Permission.js';

export class AuthorizationPolicy {
  public static readonly DEFAULT_POLICY_VERSION = '1.0.0';

  /**
   * Evaluates standard default-deny authorization rules.
   */
  public evaluate(
    request: AuthorizationRequest,
    grantedPermissions: readonly string[]
  ): AuthorizationResult {
    const requiredPermission = formatPermission(request.action, request.resourceType);

    // 1. Principal must be active
    if (request.principal.status !== 'ACTIVE') {
      return createAuthzDeny(
        `Principal '${request.principal.principalId}' is ${request.principal.status.toLowerCase()}`,
        { requiredPermission, policyVersion: AuthorizationPolicy.DEFAULT_POLICY_VERSION }
      );
    }

    // 2. Reject external agent claiming SYSTEM identity
    if (request.principal.type === 'AGENT' && request.principal.identityId.startsWith('system')) {
      return createAuthzDeny('External agents cannot assume SYSTEM identity', {
        requiredPermission,
        policyVersion: AuthorizationPolicy.DEFAULT_POLICY_VERSION,
      });
    }

    // 3. Reject prohibited actions
    if (request.action === 'EXECUTE' && request.resourceType !== 'TOOL') {
      return createAuthzDeny('Arbitrary execution of non-tool resources is prohibited', {
        requiredPermission,
        policyVersion: AuthorizationPolicy.DEFAULT_POLICY_VERSION,
      });
    }

    // 4. Check explicit permission
    const hasWildcard = grantedPermissions.includes('*') || grantedPermissions.includes(`*:${request.resourceType}`);
    const hasDirect = grantedPermissions.includes(requiredPermission);

    if (hasWildcard || hasDirect) {
      return createAuthzAllow('Access granted by permission', {
        requiredPermission,
        policyVersion: AuthorizationPolicy.DEFAULT_POLICY_VERSION,
      });
    }

    // Default deny
    return createAuthzDeny(`Missing required permission: ${requiredPermission}`, {
      requiredPermission,
      policyVersion: AuthorizationPolicy.DEFAULT_POLICY_VERSION,
    });
  }
}
