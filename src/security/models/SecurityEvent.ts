import type { SecurityPrincipal, AuthenticationMethod } from './SecurityPrincipal.js';
import type { ResourceScope } from './ResourceScope.js';
import type { SecurityTrustLevel } from './AgentIdentity.js';

export interface AuthenticationSucceededPayload {
  readonly principal: SecurityPrincipal;
  readonly authenticationMethod: AuthenticationMethod;
  readonly timestamp: string;
}

export interface AuthenticationFailedPayload {
  readonly identifier?: string | undefined;
  readonly authenticationMethod?: AuthenticationMethod | undefined;
  readonly reason: string;
  readonly timestamp: string;
}

export interface AuthorizationDeniedPayload {
  readonly principalId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | undefined;
  readonly scope: ResourceScope;
  readonly reason: string;
  readonly policyVersion: string;
  readonly timestamp: string;
}

export interface PermissionChangedPayload {
  readonly principalId: string;
  readonly grantedPermissions: readonly string[];
  readonly revokedPermissions: readonly string[];
  readonly updatedBy: string;
  readonly timestamp: string;
}

export interface IdentityCreatedPayload {
  readonly identityId: string;
  readonly type: string;
  readonly timestamp: string;
}

export interface IdentityDisabledPayload {
  readonly identityId: string;
  readonly reason: string;
  readonly disabledBy: string;
  readonly timestamp: string;
}

export interface SecurityPolicyChangedPayload {
  readonly policyId: string;
  readonly previousVersion: string;
  readonly newVersion: string;
  readonly updatedBy: string;
  readonly timestamp: string;
}

export interface SecurityViolationDetectedPayload {
  readonly violationType:
    | 'CROSS_WORKSPACE_ACCESS'
    | 'CROSS_REPOSITORY_ACCESS'
    | 'INVALID_CREDENTIAL'
    | 'EXPIRED_CREDENTIAL'
    | 'REPEATED_AUTH_FAILURE'
    | 'CAPABILITY_MISMATCH'
    | 'FORGED_PROVENANCE'
    | 'INVALID_SESSION_OWNERSHIP'
    | 'POLICY_VIOLATION'
    | 'PROMPT_INJECTION_ATTEMPT';
  readonly principalId?: string | undefined;
  readonly targetScope: ResourceScope;
  readonly details: Record<string, unknown>;
  readonly timestamp: string;
}
