import { describe, it, expect } from 'vitest';
import { TimeoutPolicy, TimeoutError } from '../../src/reliability/resilience/TimeoutPolicy.js';
import { DependencyDegradationManager } from '../../src/reliability/resilience/DependencyDegradationManager.js';

describe('Reliability - TimeoutPolicy & DependencyDegradation', () => {
  describe('TimeoutPolicy', () => {
    it('returns result when operation completes within timeout', async () => {
      const res = await TimeoutPolicy.withTimeout(async () => {
        return 'success';
      }, 500, 'quick_operation');

      expect(res).toBe('success');
    });

    it('throws TimeoutError when operation exceeds deadline', async () => {
      await expect(
        TimeoutPolicy.withTimeout(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return 'late';
          },
          25,
          'slow_operation'
        )
      ).rejects.toThrow(TimeoutError);
    });

    it('triggers AbortSignal on timeout for cooperative cancellation', async () => {
      let aborted = false;

      await expect(
        TimeoutPolicy.withTimeout(
          async (signal) => {
            signal.addEventListener('abort', () => {
              aborted = true;
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            return 'late';
          },
          30,
          'cooperative_operation'
        )
      ).rejects.toThrow(TimeoutError);

      expect(aborted).toBe(true);
    });

    it('rejects non-positive timeout duration', async () => {
      await expect(
        TimeoutPolicy.withTimeout(async () => 'ok', 0, 'invalid')
      ).rejects.toThrow('Timeout duration must be positive');
    });
  });

  describe('DependencyDegradationManager', () => {
    it('registers dependencies and defaults to available', () => {
      const manager = new DependencyDegradationManager();
      manager.register('database', 'CRITICAL');
      manager.register('vector_store', 'DEGRADABLE');
      manager.register('telemetry_exporter', 'OPTIONAL');

      const dbStatus = manager.getStatus('database');
      expect(dbStatus?.isAvailable).toBe(true);
      expect(dbStatus?.isDegraded).toBe(false);
      expect(manager.isCriticalFailure()).toBe(false);
      expect(manager.getActiveDegradations()).toHaveLength(0);
    });

    it('tracks degradation for degradable or optional dependencies without flagging critical failure', () => {
      const manager = new DependencyDegradationManager();
      manager.register('database', 'CRITICAL');
      manager.register('vector_store', 'DEGRADABLE');
      manager.register('telemetry_exporter', 'OPTIONAL');

      manager.recordFailure('vector_store', new Error('Qdrant unreachable'));
      const status = manager.getStatus('vector_store');

      expect(status?.isAvailable).toBe(false);
      expect(status?.isDegraded).toBe(true);
      expect(status?.lastError).toContain('Qdrant unreachable');
      expect(manager.isCriticalFailure()).toBe(false);

      const active = manager.getActiveDegradations();
      expect(active).toHaveLength(1);
      expect(active[0]?.name).toBe('vector_store');
      expect(active[0]?.isDegraded).toBe(true);
    });

    it('flags isCriticalFailure when a CRITICAL dependency fails', () => {
      const manager = new DependencyDegradationManager();
      manager.register('database', 'CRITICAL');

      manager.recordFailure('database', new Error('Postgres connection lost'));
      expect(manager.isCriticalFailure()).toBe(true);

      const status = manager.getStatus('database');
      expect(status?.isAvailable).toBe(false);
      expect(status?.isDegraded).toBe(false); // Critical failure is NOT merely degraded; it's a critical outage
    });

    it('clears degradation and restores status upon recordSuccess', () => {
      const manager = new DependencyDegradationManager();
      manager.register('cache', 'DEGRADABLE');

      manager.recordFailure('cache', 'Redis OOM');
      expect(manager.getActiveDegradations()).toHaveLength(1);

      manager.recordSuccess('cache');
      const status = manager.getStatus('cache');
      expect(status?.isAvailable).toBe(true);
      expect(status?.isDegraded).toBe(false);
      expect(status?.lastError).toBeUndefined();
      expect(manager.getActiveDegradations()).toHaveLength(0);
    });
  });
});
