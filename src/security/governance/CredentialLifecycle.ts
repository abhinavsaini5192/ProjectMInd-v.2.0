import type { ResourceScope } from '../models/ResourceScope.js';

export type CredentialLifecycleState =
  | 'ISSUED'
  | 'ACTIVE'
  | 'ROTATING'
  | 'REVOKED'
  | 'EXPIRED'
  | 'COMPROMISED'
  | 'UNKNOWN';

export interface ManagedCredentialReference {
  readonly credentialId: string;
  readonly name: string;
  readonly type: 'API_KEY' | 'SERVICE_TOKEN' | 'OAUTH_CLIENT' | 'AGENT_SECRET';
  readonly state: CredentialLifecycleState;
  readonly scope: ResourceScope;
  readonly issuedAt: number;
  readonly expiresAt?: number | undefined;
  readonly rotatedAt?: number | undefined;
  readonly revokedAt?: number | undefined;
  readonly compromisedAt?: number | undefined;
  readonly revocationReason?: string | undefined;
  readonly version: number;
}

export interface CredentialValidationResult {
  readonly isValid: boolean;
  readonly credentialId: string;
  readonly state: CredentialLifecycleState;
  readonly reason?: string | undefined;
}

export class CredentialLifecycleManager {
  private readonly credentials = new Map<string, ManagedCredentialReference>();

  public registerCredential(params: {
    credentialId: string;
    name: string;
    type: 'API_KEY' | 'SERVICE_TOKEN' | 'OAUTH_CLIENT' | 'AGENT_SECRET';
    scope: ResourceScope;
    ttlMs?: number | undefined;
  }): ManagedCredentialReference {
    const now = Date.now();
    const cred: ManagedCredentialReference = {
      credentialId: params.credentialId,
      name: params.name,
      type: params.type,
      state: 'ACTIVE',
      scope: params.scope,
      issuedAt: now,
      expiresAt: params.ttlMs ? now + params.ttlMs : undefined,
      version: 1,
    };
    this.credentials.set(params.credentialId, cred);
    return cred;
  }

  public validateCredential(credentialId: string): CredentialValidationResult {
    const cred = this.credentials.get(credentialId);
    if (!cred) {
      return {
        isValid: false,
        credentialId,
        state: 'UNKNOWN',
        reason: `Credential '${credentialId}' not found`,
      };
    }

    const now = Date.now();

    // Check expiration
    if (cred.expiresAt && now >= cred.expiresAt && cred.state !== 'REVOKED' && cred.state !== 'COMPROMISED') {
      const expired: ManagedCredentialReference = {
        ...cred,
        state: 'EXPIRED',
      };
      this.credentials.set(credentialId, expired);
      return {
        isValid: false,
        credentialId,
        state: 'EXPIRED',
        reason: `Credential expired at ${new Date(cred.expiresAt).toISOString()}`,
      };
    }

    if (cred.state === 'REVOKED') {
      return {
        isValid: false,
        credentialId,
        state: 'REVOKED',
        reason: `Credential was revoked: ${cred.revocationReason ?? 'unspecified reason'}`,
      };
    }

    if (cred.state === 'COMPROMISED') {
      return {
        isValid: false,
        credentialId,
        state: 'COMPROMISED',
        reason: 'Credential has been flagged as compromised and blocked',
      };
    }

    if (cred.state !== 'ACTIVE' && cred.state !== 'ROTATING') {
      return {
        isValid: false,
        credentialId,
        state: cred.state,
        reason: `Credential state '${cred.state}' is not usable for authentication`,
      };
    }

    return {
      isValid: true,
      credentialId,
      state: cred.state,
    };
  }

  public rotateCredential(credentialId: string, ttlMs?: number): ManagedCredentialReference {
    const cred = this.credentials.get(credentialId);
    if (!cred) {
      throw new Error(`Cannot rotate non-existent credential '${credentialId}'`);
    }

    const now = Date.now();
    const updated: ManagedCredentialReference = {
      ...cred,
      state: 'ROTATING',
      rotatedAt: now,
      expiresAt: ttlMs ? now + ttlMs : cred.expiresAt,
      version: cred.version + 1,
    };

    this.credentials.set(credentialId, updated);
    return updated;
  }

  public revokeCredential(credentialId: string, reason: string): ManagedCredentialReference {
    const cred = this.credentials.get(credentialId);
    if (!cred) {
      throw new Error(`Cannot revoke non-existent credential '${credentialId}'`);
    }

    const updated: ManagedCredentialReference = {
      ...cred,
      state: 'REVOKED',
      revokedAt: Date.now(),
      revocationReason: reason,
    };

    this.credentials.set(credentialId, updated);
    return updated;
  }

  public markCompromised(credentialId: string, reason: string): ManagedCredentialReference {
    const cred = this.credentials.get(credentialId);
    if (!cred) {
      throw new Error(`Cannot flag non-existent credential '${credentialId}'`);
    }

    const updated: ManagedCredentialReference = {
      ...cred,
      state: 'COMPROMISED',
      compromisedAt: Date.now(),
      revocationReason: `COMPROMISED: ${reason}`,
    };

    this.credentials.set(credentialId, updated);
    return updated;
  }

  public getCredential(credentialId: string): ManagedCredentialReference | undefined {
    return this.credentials.get(credentialId);
  }
}
