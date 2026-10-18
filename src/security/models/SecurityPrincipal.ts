import type { IdentityType } from './IdentityType.js';

export type PrincipalStatus = 'ACTIVE' | 'DISABLED' | 'SUSPENDED';

export type AuthenticationMethod =
  | 'API_KEY'
  | 'OAUTH'
  | 'JWT'
  | 'SESSION'
  | 'SERVICE_CREDENTIAL'
  | 'LOCAL_DEVELOPMENT'
  | 'SYSTEM'
  | 'UNKNOWN';

export interface SecurityPrincipal {
  readonly principalId: string;
  readonly type: IdentityType;
  readonly identityId: string;
  readonly displayName?: string | undefined;
  readonly status: PrincipalStatus;
  readonly authenticationMethod: AuthenticationMethod;
  readonly role?: string | undefined;
  readonly roles?: readonly string[] | undefined;
  readonly permissions?: readonly string[] | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly createdAt: string;
}

export function isSecurityPrincipal(value: unknown): value is SecurityPrincipal {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as SecurityPrincipal;
  return (
    typeof candidate.principalId === 'string' &&
    typeof candidate.identityId === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.status === 'string'
  );
}
