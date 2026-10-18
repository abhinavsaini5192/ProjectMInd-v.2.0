import { describe, it, expect, vi } from 'vitest';
import { StartupRecoveryManager } from '../../src/reliability/startup/StartupRecoveryManager.js';
import { GracefulShutdownCoordinator } from '../../src/reliability/shutdown/GracefulShutdownCoordinator.js';

describe('Reliability - Startup & Shutdown Lifecycles', () => {
  describe('StartupRecoveryManager', () => {
    it('executes full checklist and transitions to ready when all checks pass', async () => {
      const mockLockRecovery = {
        sweep: vi.fn().mockResolvedValue({
          purgedLocks: ['lock-1', 'lock-2'],
          activeLocks: [],
          inspectedAt: Date.now(),
        }),
      } as any;

      const mockJobRecovery = {
        recoverStaleJobs: vi.fn().mockResolvedValue({
          recoveredCount: 3,
          deadLetteredCount: 1,
        }),
      } as any;

      const mockReconciliation = {
        reconcileAll: vi.fn().mockResolvedValue({
          inconsistenciesDetected: 1,
          inconsistenciesResolved: 1,
          actionsApplied: ['Dispatched FEATURE_MAPPING'],
          manualReviewItems: [],
          durationMs: 5,
        }),
      } as any;

      const startup = new StartupRecoveryManager({
        storageValidator: () => true,
        schemaValidator: () => true,
        staleLockRecoveryManager: mockLockRecovery,
        jobRecoveryManager: mockJobRecovery,
        reconciliationService: mockReconciliation,
      });

      expect(startup.isReady()).toBe(false);

      const report = await startup.executeStartupRecovery();

      expect(report.success).toBe(true);
      expect(report.isReady).toBe(true);
      expect(startup.isReady()).toBe(true);
      expect(report.recoveredJobsCount).toBe(4);
      expect(report.purgedLeasesCount).toBe(2);
      expect(report.checks).toHaveLength(5);
      expect(mockLockRecovery.sweep).toHaveBeenCalledTimes(1);
      expect(mockJobRecovery.recoverStaleJobs).toHaveBeenCalledTimes(1);
      expect(mockReconciliation.reconcileAll).toHaveBeenCalledTimes(1);
    });

    it('blocks readiness and records errors if storage or schema check fails', async () => {
      const startup = new StartupRecoveryManager({
        storageValidator: () => false, // Storage failed
        schemaValidator: () => true,
      });

      const report = await startup.executeStartupRecovery();

      expect(report.success).toBe(false);
      expect(report.isReady).toBe(false);
      expect(startup.isReady()).toBe(false);
      expect(report.errors.some((e) => e.includes('storage_connectivity'))).toBe(true);
    });
  });

  describe('GracefulShutdownCoordinator', () => {
    it('executes all 7 shutdown steps in strict canonical sequence', async () => {
      const sequence: string[] = [];

      const coordinator = new GracefulShutdownCoordinator({
        onMarkNotReady: async () => {
          sequence.push('mark_not_ready');
        },
        onStopAcceptingWork: async () => {
          sequence.push('stop_accepting_work');
        },
        onStopSchedulers: async () => {
          sequence.push('stop_schedulers');
        },
        onDrainWorkers: async () => {
          sequence.push('drain_workers');
        },
        onReleaseLeases: async () => {
          sequence.push('release_leases');
        },
        onFlushTelemetry: async () => {
          sequence.push('flush_telemetry');
        },
        onCloseConnections: async () => {
          sequence.push('close_connections');
        },
      });

      expect(coordinator.shuttingDown).toBe(false);
      const report = await coordinator.shutdown('SIGTERM');

      expect(coordinator.shuttingDown).toBe(true);
      expect(report.success).toBe(true);
      expect(report.stepsCompleted).toEqual([
        'mark_not_ready',
        'stop_accepting_work',
        'stop_schedulers',
        'drain_workers',
        'release_leases',
        'flush_telemetry',
        'close_connections',
      ]);
      expect(sequence).toEqual(report.stepsCompleted);
    });

    it('handles idempotent shutdown invocations without re-running steps', async () => {
      const markNotReady = vi.fn();
      const coordinator = new GracefulShutdownCoordinator({
        onMarkNotReady: markNotReady,
      });

      const rep1 = await coordinator.shutdown('first');
      const rep2 = await coordinator.shutdown('second');

      expect(rep1.success).toBe(true);
      expect(rep2.stepsCompleted).toContain('already_shutting_down');
      expect(markNotReady).toHaveBeenCalledTimes(1);
    });

    it('records step errors without aborting remaining critical cleanup', async () => {
      const coordinator = new GracefulShutdownCoordinator({
        onMarkNotReady: async () => {
          throw new Error('Unready notification failed');
        },
        onCloseConnections: async () => {
          // Connection closing should still run
        },
      });

      const report = await coordinator.shutdown('crash');
      expect(report.success).toBe(false);
      expect(report.errors[0]).toContain('[mark_not_ready] Unready notification failed');
      expect(report.stepsCompleted).toContain('close_connections');
    });
  });
});
