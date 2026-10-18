import { describe, it, expect } from 'vitest';
import {
  StaleResultDetector,
  StaleComputationError,
} from '../../src/concurrency/consistency/StaleResultDetector.js';
import { ConflictResolver } from '../../src/concurrency/consistency/ConflictResolver.js';

describe('Concurrency - Stale Result Detection & Conflict Resolution', () => {
  describe('StaleResultDetector', () => {
    it('passes when current version equals computation input version', async () => {
      let currentVersion = 15;
      await expect(
        StaleResultDetector.assertFresh('feat-auth', 15, async () => currentVersion)
      ).resolves.not.toThrow();

      const check = await StaleResultDetector.checkFreshness('feat-auth', 15, async () => currentVersion);
      expect(check.isFresh).toBe(true);
    });

    it('throws StaleComputationError when current version has evolved past input version', async () => {
      // Long-running analysis started when version was 10
      const inputVersion = 10;
      // While it was running, a knowledge update committed version 12
      const currentVersion = 12;

      await expect(
        StaleResultDetector.assertFresh('feat-auth', inputVersion, async () => currentVersion)
      ).rejects.toThrow(StaleComputationError);

      try {
        await StaleResultDetector.assertFresh('feat-auth', inputVersion, async () => currentVersion);
      } catch (err) {
        expect(err).toBeInstanceOf(StaleComputationError);
        const staleErr = err as StaleComputationError;
        expect(staleErr.resourceId).toBe('feat-auth');
        expect(staleErr.inputVersion).toBe(10);
        expect(staleErr.currentVersion).toBe(12);
      }

      const check = await StaleResultDetector.checkFreshness('feat-auth', inputVersion, async () => currentVersion);
      expect(check.isFresh).toBe(false);
      expect(check.reason).toContain('newer than computation input version');
    });
  });

  describe('ConflictResolver', () => {
    const resolver = new ConflictResolver();

    it('resolves lock contention with RETRY and bounded jitter backoff under maxRetries', () => {
      const res = resolver.resolve({
        conflictType: 'RESOURCE_LOCK_CONFLICT',
        resourceKey: 'ws:1:repo:1:migration',
        attempt: 1,
        maxRetries: 3,
      });

      expect(res.action).toBe('RETRY');
      expect(res.shouldRetry).toBe(true);
      expect(res.backoffDelayMs).toBeGreaterThan(0);
      expect(res.backoffDelayMs).toBeLessThanOrEqual(2050);
    });

    it('resolves lock contention with REJECT when retries are exhausted', () => {
      const res = resolver.resolve({
        conflictType: 'RESOURCE_LOCK_CONFLICT',
        resourceKey: 'ws:1:repo:1:migration',
        attempt: 4,
        maxRetries: 3,
      });

      expect(res.action).toBe('REJECT');
      expect(res.shouldRetry).toBe(false);
    });

    it('resolves version conflict with REFRESH and retryable flag', () => {
      const res = resolver.resolve({
        conflictType: 'VERSION_CONFLICT',
        resourceKey: 'feat:login',
        expectedVersion: 3,
        actualVersion: 4,
        attempt: 1,
      });

      expect(res.action).toBe('REFRESH');
      expect(res.shouldRetry).toBe(true);
      expect(res.conflict.expectedVersion).toBe(3);
      expect(res.conflict.actualVersion).toBe(4);
    });

    it('resolves duplicate operation with IGNORE_DUPLICATE and shouldRetry=false', () => {
      const res = resolver.resolve({
        conflictType: 'DUPLICATE_OPERATION',
        resourceKey: 'evt-knowledge-obs-1',
      });

      expect(res.action).toBe('IGNORE_DUPLICATE');
      expect(res.shouldRetry).toBe(false);
    });

    it('resolves scope and security conflicts with REJECT (non-retryable)', () => {
      const res = resolver.resolve({
        conflictType: 'SCOPE_CONFLICT',
        resourceKey: 'ws:tenant-a:data',
      });

      expect(res.action).toBe('REJECT');
      expect(res.shouldRetry).toBe(false);
      expect(res.conflict.retryable).toBe(false);
    });
  });
});
