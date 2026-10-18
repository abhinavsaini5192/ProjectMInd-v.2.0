import type { PermissionAction } from '../models/PermissionAction.js';
import type { ResourceType } from '../models/ResourceType.js';
import type { SecurityTrustLevel } from '../models/AgentIdentity.js';
import { createAuthzAllow, createAuthzDeny } from '../models/AuthorizationResult.js';
import type { AuthorizationResult } from '../models/AuthorizationResult.js';

export interface AgentPolicyEvaluationParams {
  readonly action: PermissionAction;
  readonly resourceType: ResourceType;
  readonly trustLevel: SecurityTrustLevel;
  readonly hasExplicitGrant?: boolean | undefined;
}

export class AgentPolicy {
  public static readonly VERSION = '1.0.0';

  /**
   * Strictly evaluates external agent actions against the conservative agent security baseline.
   */
  public static evaluateAgentAction(params: AgentPolicyEvaluationParams): AuthorizationResult {
    const { action, resourceType, trustLevel, hasExplicitGrant } = params;

    // 1. Strict DENY categories (always denied for external agents regardless of trust level)
    if (action === 'EXECUTE' && resourceType !== 'TOOL') {
      return createAuthzDeny('External agents cannot execute arbitrary processes or repository code', {
        policyVersion: this.VERSION,
      });
    }

    if (resourceType === 'SECURITY_POLICY' && action !== 'READ') {
      return createAuthzDeny('External agents cannot modify security policies or role assignments', {
        policyVersion: this.VERSION,
      });
    }

    if (resourceType === 'CONFIGURATION' && (action === 'UPDATE' || action === 'CONFIGURE' || action === 'DELETE')) {
      return createAuthzDeny('External agents cannot modify platform or system configuration', {
        policyVersion: this.VERSION,
      });
    }

    // 2. RESTRICT categories: knowledge updates require TRUSTED/SYSTEM trust or explicit grant
    if (resourceType === 'KNOWLEDGE' && (action === 'UPDATE' || action === 'CREATE' || action === 'DELETE')) {
      if (trustLevel === 'UNTRUSTED') {
        return createAuthzDeny('UNTRUSTED agents cannot mutate the knowledge graph', {
          policyVersion: this.VERSION,
        });
      }
      if (!hasExplicitGrant && trustLevel !== 'SYSTEM' && trustLevel !== 'VERIFIED') {
        return createAuthzDeny('Knowledge mutation requires explicit authorization grant or VERIFIED/SYSTEM trust', {
          policyVersion: this.VERSION,
        });
      }
      return createAuthzAllow('Permitted knowledge update for verified/authorized agent', {
        policyVersion: this.VERSION,
      });
    }

    // 3. ALLOW categories: read context/features/impact/health, report observations & verifications
    if (action === 'READ' && ['CONTEXT', 'FEATURE', 'REPOSITORY', 'WORKSPACE', 'TASK', 'KNOWLEDGE'].includes(resourceType)) {
      return createAuthzAllow('Permitted agent retrieval operation', { policyVersion: this.VERSION });
    }

    if (action === 'REFRESH' && resourceType === 'CONTEXT') {
      return createAuthzAllow('Permitted agent context refresh', { policyVersion: this.VERSION });
    }

    if (action === 'REPORT' && (resourceType === 'OBSERVATION' || resourceType === 'VERIFICATION')) {
      return createAuthzAllow('Permitted agent reporting operation', { policyVersion: this.VERSION });
    }

    if (action === 'EXECUTE' && resourceType === 'TOOL') {
      return createAuthzAllow('Permitted canonical tool execution', { policyVersion: this.VERSION });
    }

    // If explicit grant exists for other actions, allow
    if (hasExplicitGrant) {
      return createAuthzAllow('Permitted by explicit grant', { policyVersion: this.VERSION });
    }

    return createAuthzDeny(`Action ${action} on ${resourceType} is not permitted for external agent`, {
      policyVersion: this.VERSION,
    });
  }
}
