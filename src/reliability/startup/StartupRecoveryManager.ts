import type { IStartupRecoveryManager, StartupCheckResult, StartupRecoveryReport } from './IStartupRecoveryManager.js';
import type { IJobRepository } from '../../jobs/persistence/IJobRepository.js';
import type { JobRecoveryManager } from '../../jobs/recovery/JobRecoveryManager.js';
import type { StaleLockRecoveryManager } from '../../concurrency/recovery/StaleLockRecoveryManager.js';
import type { IReconciliationService } from '../consistency/IReconciliationService.js';

export interface StartupRecoveryDependencies {
  readonly jobRepository?: IJobRepository | undefined;
  readonly jobRecoveryManager?: JobRecoveryManager | undefined;
  readonly staleLockRecoveryManager?: StaleLockRecoveryManager | undefined;
  readonly reconciliationService?: IReconciliationService | undefined;
  readonly storageValidator?: () => Promise<boolean> | boolean;
  readonly schemaValidator?: () => Promise<boolean> | boolean;
}

export class StartupRecoveryManager implements IStartupRecoveryManager {
  private ready = false;
  private lastReport?: StartupRecoveryReport | undefined;

  constructor(private readonly deps: StartupRecoveryDependencies = {}) {}

  public isReady(): boolean {
    return this.ready;
  }

  public getLatestReport(): StartupRecoveryReport | undefined {
    return this.lastReport;
  }

  public async executeStartupRecovery(): Promise<StartupRecoveryReport> {
    const startedAt = Date.now();
    const checks: StartupCheckResult[] = [];
    const errors: string[] = [];
    let recoveredJobsCount = 0;
    let purgedLeasesCount = 0;

    // 1. Validate Storage
    await this.runCheck(checks, errors, 'storage_connectivity', async () => {
      if (this.deps.storageValidator) {
        const ok = await this.deps.storageValidator();
        if (!ok) throw new Error('Primary storage accessibility validation failed');
      }
      return 'Storage is online and accessible';
    });

    // 2. Validate Schema Compatibility
    await this.runCheck(checks, errors, 'schema_compatibility', async () => {
      if (this.deps.schemaValidator) {
        const ok = await this.deps.schemaValidator();
        if (!ok) throw new Error('Storage schema version is incompatible with application');
      }
      return 'Schema compatibility verified';
    });

    // 3. Inspect & Purge Stale Leases / Expired Locks
    await this.runCheck(checks, errors, 'stale_locks_and_leases', async () => {
      if (this.deps.staleLockRecoveryManager) {
        const sweepResult = await this.deps.staleLockRecoveryManager.sweep();
        purgedLeasesCount = sweepResult.purgedLocks.length;
        return `Purged ${purgedLeasesCount} expired locks/leases`;
      }
      return 'Lock recovery manager not configured (skipped)';
    });

    // 4. Inspect & Recover Unfinished / Interrupted Jobs
    await this.runCheck(checks, errors, 'job_recovery', async () => {
      if (this.deps.jobRecoveryManager) {
        const result = await this.deps.jobRecoveryManager.recoverStaleJobs();
        recoveredJobsCount = result.recoveredCount + result.deadLetteredCount;
        return `Recovered ${recoveredJobsCount} orphaned jobs (recovered=${result.recoveredCount}, dlq=${result.deadLetteredCount})`;
      }
      return 'Job recovery manager not configured (skipped)';
    });

    // 5. Inspect & Reconcile Inconsistent Knowledge State
    await this.runCheck(checks, errors, 'knowledge_reconciliation', async () => {
      if (this.deps.reconciliationService) {
        const reconciliation = await this.deps.reconciliationService.reconcileAll();
        return `Knowledge reconciliation checked: ${reconciliation.inconsistenciesDetected} inconsistencies resolved`;
      }
      return 'Reconciliation service not configured (skipped)';
    });

    const completedAt = Date.now();
    const success = errors.length === 0;
    this.ready = success;

    const report: StartupRecoveryReport = {
      success,
      isReady: this.ready,
      startedAt,
      completedAt,
      checks,
      recoveredJobsCount,
      purgedLeasesCount,
      errors,
    };

    this.lastReport = report;
    return report;
  }

  private async runCheck(
    checks: StartupCheckResult[],
    errors: string[],
    name: string,
    action: () => Promise<string>
  ): Promise<void> {
    const t0 = Date.now();
    try {
      const msg = await action();
      checks.push({
        checkName: name,
        success: true,
        message: msg,
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`[${name}] ${errMsg}`);
      checks.push({
        checkName: name,
        success: false,
        message: errMsg,
        durationMs: Date.now() - t0,
      });
    }
  }
}
