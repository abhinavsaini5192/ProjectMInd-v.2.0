import type { ISecurityPolicyEvaluator } from '../interfaces/ISecurityPolicyEvaluator.js';
import type { AuthorizationRequest } from '../interfaces/IAuthorizer.js';
import type { SecurityPolicy } from '../models/SecurityPolicy.js';
import type { AuthorizationResult } from '../models/AuthorizationResult.js';
import { createAuthzAllow, createAuthzDeny } from '../models/AuthorizationResult.js';
import { isScopeContainedWithin } from '../models/ResourceScope.js';

export class SecurityPolicyEvaluator implements ISecurityPolicyEvaluator {
  public evaluatePolicy(request: AuthorizationRequest, policy: SecurityPolicy): AuthorizationResult {
    // 1. Policy status check
    if (policy.status !== 'ACTIVE') {
      return createAuthzDeny(`Security policy '${policy.policyId}' is ${policy.status.toLowerCase()}`, {
        policyVersion: policy.version,
      });
    }

    // 2. Policy scope check
    if (!isScopeContainedWithin(request.scope, policy.scope)) {
      return createAuthzDeny('Request scope is outside security policy scope', {
        policyVersion: policy.version,
      });
    }

    // 3. Evaluate rules (Explicit DENY overrides ALLOW)
    let hasAllow = false;
    let allowReason = 'Allowed by policy';

    for (const rule of policy.rules) {
      const actionMatch = rule.actions.includes(request.action);
      const resourceMatch = rule.resourceTypes.includes(request.resourceType);

      if (actionMatch && resourceMatch) {
        // Principal type check if specified
        if (rule.principalTypes && !rule.principalTypes.includes(request.principal.type)) {
          continue;
        }

        // Scope check if rule specifies sub-scope
        if (rule.scope && !isScopeContainedWithin(request.scope, rule.scope)) {
          continue;
        }

        if (rule.effect === 'DENY') {
          return createAuthzDeny(rule.description ?? `Denied by rule '${rule.ruleId}'`, {
            policyVersion: policy.version,
          });
        }

        if (rule.effect === 'ALLOW') {
          hasAllow = true;
          if (rule.description) {
            allowReason = rule.description;
          }
        }
      }
    }

    if (hasAllow) {
      return createAuthzAllow(allowReason, { policyVersion: policy.version });
    }

    return createAuthzDeny(`No explicit allow rule in policy '${policy.policyId}' for action ${request.action} on ${request.resourceType}`, {
      policyVersion: policy.version,
    });
  }
}
