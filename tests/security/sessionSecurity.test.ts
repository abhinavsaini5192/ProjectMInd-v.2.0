import { describe, it, expect } from 'vitest';
import { SessionManager } from '../../src/security/session/SessionManager.js';

describe('Security Session - Lifecycle & Revocation Security', () => {
  it('creates active session with bounded TTL and identity association', () => {
    const manager = new SessionManager({ defaultTtlMs: 3600000 });
    const session = manager.createSession({
      identityId: 'user-alice',
      principalId: 'p-alice',
      scope: { workspaceId: 'ws-mind' },
    });

    expect(session.sessionId).toMatch(/^sess-/);
    expect(session.identityId).toBe('user-alice');
    expect(session.isRevoked).toBe(false);
    expect(session.expiresAt).toBeGreaterThan(Date.now());

    const val = manager.validateSession(session.sessionId);
    expect(val.isValid).toBe(true);
    expect(val.session?.principalId).toBe('p-alice');
  });

  it('rejects expired sessions', () => {
    const manager = new SessionManager();
    const session = manager.createSession({
      identityId: 'user-bob',
      principalId: 'p-bob',
      scope: { workspaceId: 'ws-mind' },
      ttlMs: -500, // Expired immediately
    });

    const val = manager.validateSession(session.sessionId);
    expect(val.isValid).toBe(false);
    expect(val.reason).toContain('expired');
  });

  it('immediately blocks revoked sessions from accessing protected resources', () => {
    const manager = new SessionManager();
    const session = manager.createSession({
      identityId: 'user-eve',
      principalId: 'p-eve',
      scope: { workspaceId: 'ws-mind' },
    });

    expect(manager.validateSession(session.sessionId).isValid).toBe(true);

    manager.revokeSession(session.sessionId, 'suspicious token theft detected');

    const val = manager.validateSession(session.sessionId);
    expect(val.isValid).toBe(false);
    expect(val.reason).toContain('suspicious token theft detected');
  });

  it('invalidates all active sessions for an identity and increments security version', () => {
    const manager = new SessionManager();
    const s1 = manager.createSession({ identityId: 'user-charlie', principalId: 'p-charlie', scope: {} });
    const s2 = manager.createSession({ identityId: 'user-charlie', principalId: 'p-charlie', scope: {} });
    const sOther = manager.createSession({ identityId: 'user-david', principalId: 'p-david', scope: {} });

    expect(manager.validateSession(s1.sessionId).isValid).toBe(true);
    expect(manager.validateSession(s2.sessionId).isValid).toBe(true);
    expect(manager.validateSession(sOther.sessionId).isValid).toBe(true);

    const revokedCount = manager.invalidateAllForIdentity('user-charlie', 'password changed by user');
    expect(revokedCount).toBe(2);

    expect(manager.validateSession(s1.sessionId).isValid).toBe(false);
    expect(manager.validateSession(s2.sessionId).isValid).toBe(false);
    // Other identity unaffected
    expect(manager.validateSession(sOther.sessionId).isValid).toBe(true);

    // New session created after password reset receives bumped security version and is valid
    const newSession = manager.createSession({ identityId: 'user-charlie', principalId: 'p-charlie', scope: {} });
    expect(newSession.securityVersion).toBe(2);
    expect(manager.validateSession(newSession.sessionId).isValid).toBe(true);
  });
});
