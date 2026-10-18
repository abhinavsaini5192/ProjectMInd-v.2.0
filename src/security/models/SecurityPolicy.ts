import type { PermissionAction } from './PermissionAction.js';
import type { ResourceType } from './ResourceType.js';
import type { ResourceScope } from './ResourceScope.js';
import type { IdentityType } from './IdentityType.js';

export interface SecurityPolicyRule {
  readonly ruleId: string;
  readonly effect: 'ALLOW' | 'DENY';
  readonly actions: readonly PermissionAction[];
  readonly resourceTypes: readonly ResourceType[];
  readonly principalTypes?: readonly IdentityType[] | undefined;
  readonly requiredCapabilities?: readonly string[] | undefined;
  readonly scope?: ResourceScope | undefined;
  readonly description?: string | undefined;
}

export interface SecurityPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly status: 'ACTIVE' | 'DRAFT' | 'DEPRECATED';
  readonly scope: ResourceScope;
  readonly rules: readonly SecurityPolicyRule[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
