import type { IAuthorizer, AuthorizationRequest } from '../interfaces/IAuthorizer.js';
import type { AuthorizationResult } from '../models/AuthorizationResult.js';
import { createAuthzAllow, createAuthzDeny } from '../models/AuthorizationResult.js';
import { formatPermission } from '../models/Permission.js';
import type { IPermissionResolver } from '../interfaces/IPermissionResolver.js';
import type { IScopeValidator } from '../interfaces/IScopeValidator.js';
import type { ISecurityPolicyEvaluator } from '../interfaces/ISecurityPolicyEvaluator.js';
import type { SecurityPolicy } from '../models/SecurityPolicy.js';
import { AuthorizationPolicy } from '../policies/AuthorizationPolicy.js';
import { AgentPolicy } from '../policies/AgentPolicy.js';
import { getSecurityContextScope } from '../models/SecurityContext.js';
import type { IEventBus } from '../../events/index.js';
import { SECURITY_EVENTS } from '../events/SecurityEvents.js';

export class AuthorizationService implements IAuthorizer {
  private readonly defaultPolicy = new AuthorizationPolicy();

  constructor(
    private readonly permissionResolver: IPermissionResolver,
    private readonly scopeValidator: IScopeValidator,
    private readonly policyEvaluator?: ISecurityPolicyEvaluator | undefined,
    private readonly customPolicy?: SecurityPolicy | undefined,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const requiredPermission = formatPermission(request.action, request.resourceType);

    // 1. Status check: disabled or suspended principal is strictly denied
    if (request.principal.status !== 'ACTIVE') {
      return this.deny(
        request,
        `Principal '${request.principal.principalId}' is ${request.principal.status.toLowerCase()}`,
        requiredPermission
      );
    }

    // 2. Scope validation: if context provides authorized scope, request scope must be contained
    if (request.context) {
      const authorizedScope = getSecurityContextScope(request.context);
      const isAllowed = this.scopeValidator.isScopeAllowed(request.scope, authorizedScope);
      if (!isAllowed) {
        return this.deny(
          request,
          `Request scope is outside the security context authorized scope (cross-scope access denied)`,
          requiredPermission
        );
      }
    }

    // 3. Resolve granted permissions for the principal in the requested scope
    const grantedPermissions = await this.permissionResolver.resolvePermissions(
      request.principal.principalId,
      request.scope
    );
    const permissionKeys = grantedPermissions.map((p) => formatPermission(p.action, p.resourceType));

    // 4. If principal is an external agent, apply conservative AgentPolicy baseline
    if (request.principal.type === 'AGENT') {
      const trustLevel = request.context?.trustLevel ?? 'STANDARD';
      const hasExplicitGrant = permissionKeys.includes(requiredPermission) || permissionKeys.includes('*');

      const agentResult = AgentPolicy.evaluateAgentAction({
        action: request.action,
        resourceType: request.resourceType,
        trustLevel,
        hasExplicitGrant,
      });

      if (!agentResult.allowed) {
        return this.deny(request, agentResult.reason, requiredPermission);
      }
    }

    // 5. If custom policy evaluator is configured, evaluate policy rules
    if (this.policyEvaluator && this.customPolicy) {
      const policyResult = this.policyEvaluator.evaluatePolicy(request, this.customPolicy);
      if (!policyResult.allowed) {
        return this.deny(request, policyResult.reason, requiredPermission);
      }
      return policyResult;
    }

    // 6. Evaluate standard RBAC policy
    const result = this.defaultPolicy.evaluate(request, permissionKeys);
    if (!result.allowed) {
      return this.deny(request, result.reason, requiredPermission);
    }

    return result;
  }

  private async deny(
    request: AuthorizationRequest,
    reason: string,
    requiredPermission: string
  ): Promise<AuthorizationResult> {
    if (this.eventBus) {
      this.eventBus.publish(SECURITY_EVENTS.AUTHORIZATION_DENIED, {
        principalId: request.principal.principalId,
        action: request.action,
        resourceType: request.resourceType,
        resourceId: request.resourceId,
        scope: request.scope,
        reason,
        policyVersion: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    }

    return createAuthzDeny(reason, {
      requiredPermission,
      policyVersion: '1.0.0',
    });
  }
}
