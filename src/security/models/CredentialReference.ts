import type { AuthenticationMethod } from './SecurityPrincipal.js';

export interface CredentialReference {
  readonly credentialId: string;
  readonly principalId: string;
  readonly type: AuthenticationMethod;
  readonly keyPrefix?: string | undefined;
  readonly createdAt: string;
  readonly expiresAt?: string | undefined;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly metadata?: Record<string, unknown> | undefined;
}

export function isCredentialActive(credential: CredentialReference, now: Date = new Date()): boolean {
  if (credential.status !== 'ACTIVE') {
    return false;
  }
  if (credential.expiresAt) {
    const expiration = new Date(credential.expiresAt).getTime();
    if (now.getTime() > expiration) {
      return false;
    }
  }
  return true;
}
