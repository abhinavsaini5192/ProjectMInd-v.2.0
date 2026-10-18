import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as http from 'node:http';
import { AuthenticationService } from '../../src/security/core/AuthenticationService.js';
import { SessionManager } from '../../src/security/session/SessionManager.js';
import { CredentialLifecycleManager } from '../../src/security/governance/CredentialLifecycle.js';
import { PrincipalResolver } from '../../src/security/core/PrincipalResolver.js';
import { createAuthenticationMiddleware } from '../../src/api/middleware/AuthenticationMiddleware.js';
import { SecurityContextManager } from '../../src/security/core/SecurityContextManager.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { CrossScopeGuard, CrossScopeViolationError } from '../../src/security/hardening/CrossScopeGuard.js';
import { PathTraversalGuard, PathTraversalError } from '../../src/security/hardening/PathTraversalGuard.js';
import { FilesystemValidator } from '../../src/storage/filesystem/validators/FilesystemValidator.js';
import { AuditLogger } from '../../src/security/core/AuditLogger.js';
import { TenantIsolationGuard } from '../../src/jobs/security/TenantIsolationGuard.js';
import { JobAuthorizationValidator } from '../../src/jobs/security/JobAuthorizationValidator.js';
import { HttpAdapter } from '../../src/api/adapters/HttpAdapter.js';
import { ApiService } from '../../src/api/services/ApiService.js';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { ApiErrorMapper } from '../../src/api/errors/ApiErrorMapper.js';
import { SqliteDatabaseRestoreManager } from '../../src/storage/recovery/SqliteDatabaseRestoreManager.js';
import type { Job } from '../../src/jobs/models/Job.js';

describe('Phase 10.8: Enterprise Security Hardening & Operational Governance', () => {
  describe('1. Authentication Hardening & Session Lifecycle', () => {
    let principalResolver: PrincipalResolver;
    let sessionManager: SessionManager;
    let credLifecycle: CredentialLifecycleManager;

    beforeEach(() => {
      principalResolver = new PrincipalResolver();
      sessionManager = new SessionManager({ defaultTtlMs: 3600000 });
      credLifecycle = new CredentialLifecycleManager();
    });

    it('strictly prohibits LOCAL_DEVELOPMENT authentication in production mode', async () => {
      const authService = new AuthenticationService(
        principalResolver,
        undefined,
        undefined,
        undefined,
        { environment: 'production', allowUnsafeDevDefaults: false },
        sessionManager,
        credLifecycle
      );

      const result = await authService.authenticate({
        method: 'LOCAL_DEVELOPMENT',
        developmentPrincipalId: 'attacker_dev',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PROD_DEV_AUTH_FORBIDDEN');
    });

    it('rejects expired sessions during SESSION authentication', async () => {
      const authService = new AuthenticationService(
        principalResolver,
        undefined,
        undefined,
        undefined,
        { environment: 'development' },
        sessionManager,
        credLifecycle
      );

      // Create session with 1ms TTL
      const session = sessionManager.createSession({
        identityId: 'user_1',
        principalId: 'p_1',
        scope: { workspaceId: 'ws_alpha' },
        ttlMs: 1,
      });

      // Wait 10ms for expiration
      await new Promise((r) => setTimeout(r, 10));

      const result = await authService.authenticate({
        method: 'SESSION',
        sessionId: session.sessionId,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SESSION_INVALID');
      expect(result.errorMessage).toContain('expired');
    });

    it('rejects revoked sessions during SESSION authentication', async () => {
      const authService = new AuthenticationService(
        principalResolver,
        undefined,
        undefined,
        undefined,
        { environment: 'development' },
        sessionManager,
        credLifecycle
      );

      const session = sessionManager.createSession({
        identityId: 'user_1',
        principalId: 'p_1',
        scope: { workspaceId: 'ws_alpha' },
      });

      sessionManager.revokeSession(session.sessionId, 'Suspicious login activity');

      const result = await authService.authenticate({
        method: 'SESSION',
        sessionId: session.sessionId,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SESSION_INVALID');
      expect(result.errorMessage).toContain('revoked');
    });

    it('invalidates all active sessions when identity security version is incremented', async () => {
      const authService = new AuthenticationService(
        principalResolver,
        undefined,
        undefined,
        undefined,
        { environment: 'development' },
        sessionManager,
        credLifecycle
      );

      const session = sessionManager.createSession({
        identityId: 'user_compromised',
        principalId: 'p_compromised',
        scope: { workspaceId: 'ws_alpha' },
      });

      // Security admin forces invalidation of all sessions for this user
      sessionManager.invalidateAllForIdentity('user_compromised', 'Security reset forced');

      const result = await authService.authenticate({
        method: 'SESSION',
        sessionId: session.sessionId,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SESSION_INVALID');
    });

    it('rejects revoked or compromised API key credentials', async () => {
      const authService = new AuthenticationService(
        principalResolver,
        undefined,
        undefined,
        undefined,
        { environment: 'development' },
        sessionManager,
        credLifecycle
      );

      credLifecycle.registerCredential({
        credentialId: 'apikey-revoked-test',
        name: 'Stale Production Key',
        type: 'API_KEY',
        scope: { workspaceId: 'ws_1' },
      });

      credLifecycle.revokeCredential('apikey-revoked-test', 'Compromised via git leak');

      const result = await authService.authenticate({
        method: 'API_KEY',
        apiKey: 'apikey-revoked-test',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CREDENTIAL_INVALID');
      expect(result.errorMessage).toContain('revoked');
    });

    it('AuthenticationMiddleware blocks x-dev-principal-id header in production', async () => {
      const authService = new AuthenticationService(principalResolver);
      const roleResolver = new RoleResolver();
      const permResolver = new PermissionResolver(roleResolver);
      const secContext = new SecurityContextManager(permResolver);

      const middleware = createAuthenticationMiddleware({
        authenticator: authService,
        securityContextManager: secContext,
        environment: 'production',
      });

      const req: any = {
        headers: { 'x-dev-principal-id': 'dev_hacker' },
        context: {},
      };

      await expect(middleware(req, async () => ({} as any))).rejects.toThrow(
        /Developer authentication headers .* are strictly prohibited in production/i
      );
    });
  });

  describe('2. Organization, Workspace & Tenant Isolation', () => {
    it('denies cross-workspace access via CrossScopeGuard', () => {
      const authorizedScope = { workspaceId: 'ws_alpha' };
      const requestedScope = { workspaceId: 'ws_bravo' };

      expect(() => {
        CrossScopeGuard.assertScopeAccess(authorizedScope, requestedScope, 'GetRepositoryData');
      }).toThrow(CrossScopeViolationError);
    });

    it('denies cross-repository access within the same workspace', () => {
      const authorizedScope = { workspaceId: 'ws_alpha', repositoryId: 'repo_1' };
      const requestedScope = { workspaceId: 'ws_alpha', repositoryId: 'repo_2' };

      expect(() => {
        CrossScopeGuard.assertScopeAccess(authorizedScope, requestedScope, 'FetchContext');
      }).toThrow(CrossScopeViolationError);
    });

    it('generates strictly isolated tenant cache keys', () => {
      const scopeA = { workspaceId: 'tenant_A' };
      const scopeB = { workspaceId: 'tenant_B', repositoryId: 'repo_main' };

      const keyA = CrossScopeGuard.buildScopedCacheKey(scopeA, 'context:123');
      const keyB = CrossScopeGuard.buildScopedCacheKey(scopeB, 'context:123');

      expect(keyA).toBe('ws:tenant_A:context:123');
      expect(keyB).toBe('ws:tenant_B:repo:repo_main:context:123');

      expect(CrossScopeGuard.validateCacheKey(scopeA, keyA)).toBe(true);
      expect(CrossScopeGuard.validateCacheKey(scopeA, keyB)).toBe(false);
    });

    it('TenantIsolationGuard blocks cross-workspace and cross-org job requests', () => {
      expect(() => {
        TenantIsolationGuard.assertWorkspaceAccess('ws_target', 'ws_caller');
      }).toThrow(/Access denied: Target workspace 'ws_target' does not match caller workspace 'ws_caller'/);

      expect(() => {
        TenantIsolationGuard.assertOrganizationAccess('org_a', 'org_b');
      }).toThrow(/Cross-organization access between 'org_a' and 'org_b' is prohibited/);
    });

    it('JobAuthorizationValidator prevents job execution under mismatched workspace context', () => {
      const dummyJob: Job = {
        jobId: 'job_123',
        type: 'SEMANTIC_INDEX_UPDATE',
        status: 'QUEUED',
        priority: 'NORMAL',
        payload: { repo: 'my-repo' },
        workspaceId: 'ws_tenant_1',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 60000,
        version: 1,
      };

      expect(() => {
        JobAuthorizationValidator.validate(dummyJob, { principalId: 'p-1', workspaceId: 'ws_tenant_2' });
      }).toThrow(/Cross-workspace execution denied/);
    });

    it('blocks raw credentials and secret exposure in job payloads', () => {
      const secretJob: Job = {
        jobId: 'job_secret',
        type: 'KNOWLEDGE_UPDATE',
        status: 'QUEUED',
        priority: 'HIGH',
        payload: {
          service: 'github',
          api_key: 'ghp_secret_token_12345',
        },
        workspaceId: 'ws_1',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 60000,
        version: 1,
      };

      expect(() => {
        JobAuthorizationValidator.validate(secretJob, { principalId: 'p-1', workspaceId: 'ws_1' });
      }).toThrow(/Raw credentials are strictly forbidden in job payloads/);
    });

    it('TenantIsolationGuard blocks prototype pollution and executable injection patterns', () => {
      expect(() => {
        TenantIsolationGuard.assertPayloadSafe(JSON.parse('{"__proto__": {"isAdmin": true}}'));
      }).toThrow(/prohibited executable or prototype pollution/);

      expect(() => {
        TenantIsolationGuard.assertPayloadSafe({
          command: '/bin/sh -c rm -rf /',
        });
      }).toThrow(/prohibited executable or prototype pollution/);
    });
  });

  describe('3. Filesystem & Path Traversal Guard', () => {
    const baseDir = path.resolve('tests/fixtures/sandbox');

    it('allows safe subpaths within the authorized root', () => {
      const safeRelative = 'data/models/config.json';
      const resolved = PathTraversalGuard.assertSafePath(baseDir, safeRelative);
      expect(resolved).toBe(path.resolve(baseDir, safeRelative));
      expect(PathTraversalGuard.isSafePath(baseDir, safeRelative)).toBe(true);
    });

    it('blocks directory traversal escape attempts (../..)', () => {
      const malicious = '../../../../windows/system32/cmd.exe';
      expect(() => {
        PathTraversalGuard.assertSafePath(baseDir, malicious);
      }).toThrow(PathTraversalError);
      expect(PathTraversalGuard.isSafePath(baseDir, malicious)).toBe(false);
    });

    it('blocks null-byte injection attacks', () => {
      const nullByte = 'valid.txt\0/../../etc/shadow';
      expect(() => {
        PathTraversalGuard.assertSafePath(baseDir, nullByte);
      }).toThrow(PathTraversalError);
    });

    it('prevents prefix collision attacks in FilesystemValidator and PathTraversalGuard', () => {
      const base = path.resolve('/app/workspace');
      // Subpath that shares the prefix string but is in an unauthorized sibling directory
      const siblingPath = '../workspace_attack/secret.txt';

      expect(FilesystemValidator.isSafeSubpath(base, siblingPath)).toBe(false);
      expect(PathTraversalGuard.isSafePath(base, siblingPath)).toBe(false);
    });

    it('sanitizes relative paths removing dangerous escape segments', () => {
      const sanitized = PathTraversalGuard.sanitizeRelativePath('../../etc/passwd');
      expect(sanitized).toBe(path.join('etc', 'passwd'));
      expect(sanitized.includes('..')).toBe(false);
    });
  });

  describe('4. Tamper-Aware Cryptographic Audit Logging', () => {
    let auditLogger: AuditLogger;

    beforeEach(() => {
      auditLogger = new AuditLogger();
    });

    it('computes SHA-256 hash chaining on all audit events', async () => {
      const event1 = await auditLogger.logEvent({
        eventType: 'AUTHENTICATION_SUCCESS',
        principalId: 'p_1',
        workspaceId: 'ws_1',
        result: 'SUCCESS',
      });

      const event2 = await auditLogger.logEvent({
        eventType: 'AUTHORIZATION_ALLOW',
        principalId: 'p_1',
        workspaceId: 'ws_1',
        action: 'READ',
        result: 'ALLOWED',
      });

      expect(event1.sequenceNumber).toBe(1);
      expect(event1.previousHash).toBe('0'.repeat(64));
      expect(event1.hash).toBeDefined();

      expect(event2.sequenceNumber).toBe(2);
      expect(event2.previousHash).toBe(event1.hash);
      expect(event2.hash).toBeDefined();

      const integrity = await auditLogger.verifyIntegrity();
      expect(integrity.isTamperFree).toBe(true);
      expect(integrity.totalEvents).toBe(2);
    });

    it('detects tampering when an audit event payload is modified', async () => {
      await auditLogger.logEvent({
        eventType: 'AUTHENTICATION_SUCCESS',
        principalId: 'p_alice',
        result: 'SUCCESS',
      });

      await auditLogger.logEvent({
        eventType: 'SECURITY_VIOLATION',
        principalId: 'p_attacker',
        result: 'FAILURE',
        reason: 'Illegal privilege escalation',
      });

      // Simulate attacker tampering with in-memory / stored event list
      const events = (auditLogger as any).events;
      events[1] = {
        ...events[1],
        result: 'SUCCESS', // Modified from FAILURE to SUCCESS!
      };

      const integrity = await auditLogger.verifyIntegrity();
      expect(integrity.isTamperFree).toBe(false);
      expect(integrity.brokenAtEventId).toBe(events[1].eventId);
      expect(integrity.reason).toContain('Data tampering detected');
    });

    it('detects missing or deleted events in the audit log sequence', async () => {
      await auditLogger.logEvent({ eventType: 'AUTHENTICATION_SUCCESS', result: 'SUCCESS' });
      await auditLogger.logEvent({ eventType: 'AUTHORIZATION_ALLOW', result: 'ALLOWED' });
      await auditLogger.logEvent({ eventType: 'POLICY_CHANGED', result: 'SUCCESS' });

      // Attacker deletes the second event
      const events = (auditLogger as any).events;
      events.splice(1, 1);

      const integrity = await auditLogger.verifyIntegrity();
      expect(integrity.isTamperFree).toBe(false);
      expect(integrity.reason).toMatch(/(Sequence gap|Hash chain break)/);
    });
  });

  describe('5. API & HTTP Security Hardening', () => {
    let apiService: ApiService;
    let httpAdapter: HttpAdapter;

    beforeEach(() => {
      const router = new ApiRouter();
      router.get('/v1/test', async () => ({
        status: 200,
        data: { message: 'ok' },
        meta: {
          requestId: 'req-test',
          correlationId: 'corr-test',
          apiVersion: '1.0.0',
          timestamp: Date.now(),
        },
      }));
      apiService = new ApiService({ router });
      httpAdapter = new HttpAdapter(apiService, {
        cors: {
          allowedOrigins: ['https://app.projectmind.ai'],
          allowCredentials: true,
        },
      });
    });

    it('applies standard enterprise security headers on all responses', async () => {
      const headers = httpAdapter.getDefaultSecurityHeaders();

      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['strict-transport-security']).toContain('max-age=31536000');
      expect(headers['content-security-policy']).toBe("default-src 'self'");
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('enforces safe CORS headers and rejects wildcard with credentials', async () => {
      const adapterWithWildcard = new HttpAdapter(apiService, {
        cors: {
          allowedOrigins: ['*'],
          allowCredentials: true,
        },
      });

      // When origin is sent, it should echo origin, NOT wildcard * when credentials are true
      const req: any = {
        method: 'OPTIONS',
        url: '/v1/test',
        headers: {
          origin: 'https://evil.com',
        },
      };

      let status = 0;
      let writtenHeaders: any = {};
      const res: any = {
        writeHead: (s: number, h: any) => {
          status = s;
          writtenHeaders = h;
        },
        end: () => {},
      };

      await adapterWithWildcard.handleRequest(req, res);
      expect(status).toBe(204);
      expect(writtenHeaders['access-control-allow-origin']).toBe('https://evil.com');
      expect(writtenHeaders['access-control-allow-credentials']).toBe('true');
    });

    it('redacts raw API keys and database credentials from API error responses', () => {
      const internalLeakError = new Error(
        'Database connection failed: postgres://admin:superSecretPass123!@db.internal:5432/pm with token sk-ant-api03-abcdefg1234567890abcdefg'
      );

      const mapped = ApiErrorMapper.map(internalLeakError, { path: '/v1/projects' });

      expect(mapped.detail).not.toContain('superSecretPass123!');
      expect(mapped.detail).not.toContain('sk-ant-api03-abcdefg1234567890abcdefg');
      expect(mapped.detail).toContain('[REDACTED]');
    });
  });

  describe('6. Backup & Recovery Security Controls', () => {
    it('rejects database restoration without operational authorization (authorizedBy)', async () => {
      const restoreManager = new SqliteDatabaseRestoreManager({
        backupDirectory: './tests/fixtures/backups',
      });

      const validation = await restoreManager.validateRestore({
        backupId: 'backup_test_1',
        targetDatabasePath: './test_restore.db',
        authorizedBy: '', // Missing authorization!
      });

      expect(validation.canRestore).toBe(false);
      expect(validation.errors).toContain(
        'Restore requires explicit operational authorization (authorizedBy)'
      );
    });

    it('blocks accidental overwrite of production database without confirmProductionOverwrite', async () => {
      const restoreManager = new SqliteDatabaseRestoreManager({
        backupDirectory: './tests/fixtures/backups',
        defaultActiveDatabasePath: './production.db',
      });

      const validation = await restoreManager.validateRestore({
        backupId: 'backup_test_1',
        targetDatabasePath: './production.db', // Active production DB
        authorizedBy: 'sec_admin_ops',
        confirmProductionOverwrite: false, // NOT confirmed!
      });

      expect(validation.canRestore).toBe(false);
      expect(validation.errors.some((e) => e.includes('Destructive production restore is blocked'))).toBe(true);
    });
  });
});
