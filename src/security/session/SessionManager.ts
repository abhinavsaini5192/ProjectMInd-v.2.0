import { randomUUID } from 'crypto';
import type { ResourceScope } from '../models/ResourceScope.js';

export interface SecuritySession {
  readonly sessionId: string;
  readonly identityId: string;
  readonly principalId: string;
  readonly scope: ResourceScope;
  readonly createdAt: number;
  readonly lastActivityAt: number;
  readonly expiresAt: number;
  readonly isRevoked: boolean;
  readonly revokedReason?: string | undefined;
  readonly securityVersion: number;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface SessionValidationResult {
  readonly isValid: boolean;
  readonly session?: SecuritySession | undefined;
  readonly reason?: string | undefined;
}

export class SessionManager {
  private readonly sessions = new Map<string, SecuritySession>();
  private readonly identitySecurityVersions = new Map<string, number>();
  private readonly defaultTtlMs: number;

  constructor(options: { defaultTtlMs?: number } = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 3600000; // 1 hour default
  }

  public createSession(params: {
    identityId: string;
    principalId: string;
    scope: ResourceScope;
    ttlMs?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): SecuritySession {
    const sessionId = `sess-${randomUUID()}`;
    const now = Date.now();
    const ttl = params.ttlMs ?? this.defaultTtlMs;
    const currentVersion = this.identitySecurityVersions.get(params.identityId) ?? 1;

    const session: SecuritySession = {
      sessionId,
      identityId: params.identityId,
      principalId: params.principalId,
      scope: params.scope,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + ttl,
      isRevoked: false,
      securityVersion: currentVersion,
      metadata: params.metadata,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  public validateSession(sessionId: string): SessionValidationResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        isValid: false,
        reason: `Session '${sessionId}' not found`,
      };
    }

    if (session.isRevoked) {
      return {
        isValid: false,
        session,
        reason: `Session is revoked: ${session.revokedReason ?? 'unspecified reason'}`,
      };
    }

    const now = Date.now();
    if (now >= session.expiresAt) {
      return {
        isValid: false,
        session,
        reason: `Session expired at ${new Date(session.expiresAt).toISOString()}`,
      };
    }

    const activeIdentityVersion = this.identitySecurityVersions.get(session.identityId) ?? 1;
    if (session.securityVersion < activeIdentityVersion) {
      return {
        isValid: false,
        session,
        reason: `Session security version ${session.securityVersion} is outdated (identity is at version ${activeIdentityVersion})`,
      };
    }

    return {
      isValid: true,
      session,
    };
  }

  public touchSession(sessionId: string, extensionMs?: number): boolean {
    const validation = this.validateSession(sessionId);
    if (!validation.isValid || !validation.session) {
      return false;
    }

    const now = Date.now();
    const updated: SecuritySession = {
      ...validation.session,
      lastActivityAt: now,
      expiresAt: extensionMs ? now + extensionMs : validation.session.expiresAt,
    };

    this.sessions.set(sessionId, updated);
    return true;
  }

  public revokeSession(sessionId: string, reason: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const updated: SecuritySession = {
      ...session,
      isRevoked: true,
      revokedReason: reason,
    };

    this.sessions.set(sessionId, updated);
    return true;
  }

  public invalidateAllForIdentity(identityId: string, reason: string): number {
    let count = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.identityId === identityId && !session.isRevoked) {
        this.sessions.set(id, {
          ...session,
          isRevoked: true,
          revokedReason: reason,
        });
        count++;
      }
    }

    // Bump identity security version to instantly invalidate any lingering caches
    const current = this.identitySecurityVersions.get(identityId) ?? 1;
    this.identitySecurityVersions.set(identityId, current + 1);

    return count;
  }

  public getSession(sessionId: string): SecuritySession | undefined {
    return this.sessions.get(sessionId);
  }
}
