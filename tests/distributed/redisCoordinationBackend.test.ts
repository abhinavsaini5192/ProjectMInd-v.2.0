import { describe, it, expect, vi } from 'vitest';
import {
  RedisCoordinationBackend,
  type RedisBackendLogger,
} from '../../src/distributed/coordination/RedisCoordinationBackend.js';
import { ConfigRedactor } from '../../src/platform/config/ConfigRedactor.js';

describe('RedisCoordinationBackend — Lifecycle, Observability & Credential Safety', () => {
  describe('1. Credential Redaction and Sanitization', () => {
    it('sanitizes password-only URLs and never exposes password in getSanitizedUrl()', () => {
      const secret = 'superSecretPass_998877';
      const backend = new RedisCoordinationBackend({
        redisUrl: `redis://:${secret}@127.0.0.1:6379`,
      });

      const sanitized = backend.getSanitizedUrl();
      expect(sanitized).not.toContain(secret);
      expect(sanitized).toBe('redis://:[REDACTED]@127.0.0.1:6379');
    });

    it('sanitizes user-pass and TLS URLs correctly', () => {
      const secret = 'secretUserPass_112233';
      const backend = new RedisCoordinationBackend({
        redisUrl: `rediss://pm_admin:${secret}@cluster.prod.internal:6380/2`,
      });

      const sanitized = backend.getSanitizedUrl();
      expect(sanitized).not.toContain(secret);
      expect(sanitized).toBe('rediss://pm_admin:[REDACTED]@cluster.prod.internal:6380/2');
    });

    it('redacts credentials from connection failure error messages when Redis is unreachable', async () => {
      const secret = 'ultraSecretPasswordXYZ_4455';
      const unreachableBackend = new RedisCoordinationBackend({
        redisUrl: `redis://admin:${secret}@127.0.0.1:63999`,
        connectTimeoutMs: 500,
        maxRetriesPerRequest: 0,
      });

      // Health check probe
      const health = await unreachableBackend.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.message).not.toContain(secret);
      expect(health.message).toContain('[REDACTED]');

      // Direct lock acquisition failure
      let thrownError: Error | null = null;
      try {
        await unreachableBackend.acquireLock('test-key', 'owner-1', 2000);
      } catch (err: unknown) {
        thrownError = err as Error;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).not.toContain(secret);
      expect(thrownError!.message).toContain('[REDACTED]');

      await unreachableBackend.close();
    });
  });

  describe('2. Error Observability without Silent Swallowing or Crashes', () => {
    it('records last error and connection state on failure without throwing unhandled exceptions', async () => {
      const backend = new RedisCoordinationBackend({
        redisUrl: 'redis://127.0.0.1:63999',
        connectTimeoutMs: 500,
        maxRetriesPerRequest: 0,
      });

      expect(backend.getConnectionState()).toBe('DISCONNECTED');
      expect(backend.getLastError()).toBeNull();

      const health = await backend.healthCheck();
      expect(health.healthy).toBe(false);
      expect(backend.getLastError()).not.toBeNull();
      expect(backend.getConnectionState()).toBe('DISCONNECTED');

      await backend.close();
      expect(backend.getConnectionState()).toBe('CLOSED');
    });

    it('emits structured warnings to logger when operations fail or network errors occur', async () => {
      const loggedWarnings: Array<{ msg: string; meta?: any }> = [];
      const loggedErrors: Array<{ msg: string; meta?: any }> = [];

      const mockLogger: RedisBackendLogger = {
        warn(msg: string, meta?: any) {
          loggedWarnings.push({ msg, meta });
        },
        error(msg: string, meta?: any) {
          loggedErrors.push({ msg, meta });
        },
      };

      let errorCallbackFired = false;
      const backend = new RedisCoordinationBackend({
        redisUrl: 'redis://:testSecret@127.0.0.1:63999',
        connectTimeoutMs: 500,
        maxRetriesPerRequest: 0,
        logger: mockLogger,
        onError: (_err) => {
          errorCallbackFired = true;
        },
      });

      // Trigger connection attempt
      const health = await backend.healthCheck();
      expect(health.healthy).toBe(false);

      // Verify logger received error notice
      expect(loggedErrors.length).toBeGreaterThan(0);
      expect(loggedErrors[0]!.msg).toContain('Redis coordination backend connection failed');
      expect(JSON.stringify(loggedErrors[0]!.meta)).not.toContain('testSecret');
      expect(JSON.stringify(loggedErrors[0]!.meta)).toContain('[REDACTED]');

      expect(errorCallbackFired).toBe(true);
      await backend.close();
    });

    it('supports structured logger interface (ProductionLogger style) without runtime error', async () => {
      const structuredEntries: any[] = [];
      const structuredLogger: RedisBackendLogger = {
        warn(entry: any) {
          structuredEntries.push(entry);
        },
        error(entry: any) {
          structuredEntries.push(entry);
        },
        writeLog: vi.fn(), // marker for ILogger
      } as any;

      const backend = new RedisCoordinationBackend({
        redisUrl: 'redis://127.0.0.1:63999',
        connectTimeoutMs: 500,
        maxRetriesPerRequest: 0,
        logger: structuredLogger,
      });

      await backend.healthCheck();
      expect(structuredEntries.length).toBeGreaterThan(0);
      expect(structuredEntries[0].component).toBe('RedisCoordinationBackend');
      expect(structuredEntries[0].operation).toBe('coordination');

      await backend.close();
    });
  });

  describe('3. Resource Cleanup and Subscriber Tracking', () => {
    it('tracks active subscribers and cleans them up completely on close()', async () => {
      const backend = new RedisCoordinationBackend({
        redisUrl: 'redis://127.0.0.1:63999',
        connectTimeoutMs: 500,
        maxRetriesPerRequest: 0,
      });

      expect(backend.getSubscribersCount()).toBe(0);

      // Attempt subscribe against unreachable redis — should reject cleanly without leaking
      await expect(
        backend.subscribe('test-channel', (_msg) => {})
      ).rejects.toThrow();

      // Subscriber count remains 0 because failed subscription was cleaned up
      expect(backend.getSubscribersCount()).toBe(0);

      await backend.close();
      expect(backend.getConnectionState()).toBe('CLOSED');
    });

    it('rejects subscribe operations when backend is already closed', async () => {
      const backend = new RedisCoordinationBackend({
        redisUrl: 'redis://127.0.0.1:63999',
      });
      await backend.close();

      await expect(
        backend.subscribe('test-channel', (_msg) => {})
      ).rejects.toThrow(/closed/i);
    });

    it('reports unhealthy immediately if healthCheck is invoked after close()', async () => {
      const backend = new RedisCoordinationBackend();
      await backend.close();

      const health = await backend.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('closed');
    });
  });

  describe('4. Distributed Guarantees & Safe Failure Modes', () => {
    it('fails closed: renewLock and releaseLock return false rather than pretending success when unreachable', async () => {
      const backend = new RedisCoordinationBackend({
        redisUrl: 'redis://127.0.0.1:63999',
        connectTimeoutMs: 500,
        maxRetriesPerRequest: 0,
      });

      // Renew on unreachable backend must return false (cannot claim renewal)
      const renewResult = await backend.renewLock('unreachable-key', 'owner-1', 1, 5000);
      expect(renewResult).toBe(false);

      // Release on unreachable backend must return false (cannot claim release)
      const releaseResult = await backend.releaseLock('unreachable-key', 'owner-1', 1);
      expect(releaseResult).toBe(false);

      // Inspect lock must return null (not false lock data)
      const inspectResult = await backend.inspectLock('unreachable-key');
      expect(inspectResult).toBeNull();

      // Force release must return false
      const forceResult = await backend.forceRelease('unreachable-key');
      expect(forceResult).toBe(false);

      await backend.close();
    });

    it('CAS primitives (setNx, set, get, delete) reject safely when backend is unreachable', async () => {
      const backend = new RedisCoordinationBackend({
        redisUrl: 'redis://127.0.0.1:63999',
        connectTimeoutMs: 500,
        maxRetriesPerRequest: 0,
      });

      await expect(backend.setNx('cas-key', 'val-1')).rejects.toThrow();
      await expect(backend.set('key', 'val')).rejects.toThrow();
      await expect(backend.get('key')).rejects.toThrow();
      await expect(backend.delete('key')).rejects.toThrow();
      await expect(backend.listKeys('prefix')).rejects.toThrow();
      await expect(backend.publish('chan', 'msg')).rejects.toThrow();

      await backend.close();
    });
  });
});
