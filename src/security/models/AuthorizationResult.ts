export interface AuthorizationResult {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiredPermission?: string | undefined;
  readonly policyVersion?: string | undefined;
  readonly warnings: readonly string[];
}

export function createAuthzAllow(
  reason: string = 'Access granted',
  options?: { requiredPermission?: string; policyVersion?: string; warnings?: string[] }
): AuthorizationResult {
  return {
    allowed: true,
    reason,
    requiredPermission: options?.requiredPermission,
    policyVersion: options?.policyVersion ?? '1.0.0',
    warnings: options?.warnings ?? [],
  };
}

export function createAuthzDeny(
  reason: string = 'Access denied',
  options?: { requiredPermission?: string; policyVersion?: string; warnings?: string[] }
): AuthorizationResult {
  return {
    allowed: false,
    reason,
    requiredPermission: options?.requiredPermission,
    policyVersion: options?.policyVersion ?? '1.0.0',
    warnings: options?.warnings ?? [],
  };
}
