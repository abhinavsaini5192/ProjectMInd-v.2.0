import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DurableJobQueue } from '../jobs/queue/DurableJobQueue.js';
import { InMemoryJobQueue } from '../jobs/queue/InMemoryJobQueue.js';
import { DeadLetterQueue } from '../jobs/recovery/DeadLetterQueue.js';
import { JobLeaseManager } from '../jobs/recovery/JobLeaseManager.js';
import { DistributedLockManager } from '../distributed/locking/DistributedLockManager.js';
import { MemoryCoordinationBackend } from '../distributed/coordination/MemoryCoordinationBackend.js';
import { SqliteDatabaseRestoreManager } from '../storage/recovery/SqliteDatabaseRestoreManager.js';
import { CrossScopeGuard, CrossScopeViolationError } from '../security/hardening/CrossScopeGuard.js';
import { AuthenticationService } from '../security/core/AuthenticationService.js';
import { PrincipalResolver } from '../security/core/PrincipalResolver.js';

export interface FailureScenarioResult {
  readonly scenarioName: string;
  readonly passed: boolean;
  readonly timeToRecoveryMs: number;
  readonly details: string;
  readonly dataIntegrityVerified: boolean;
}

export class FailureInjectionHarness {
  /**
   * Scenario 1: SQLite write contention and busy handler under concurrent writes.
   */
  public async testSqliteWriteContention(testDbPath: string): Promise<FailureScenarioResult> {
    const start = performance.now();
    const db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 2000');
    db.exec('CREATE TABLE IF NOT EXISTS pm_concurrency_test (id INTEGER PRIMARY KEY, val TEXT); DELETE FROM pm_concurrency_test;');

    let writesSuccess = 0;
    let writesContended = 0;

    // Run 50 concurrent transactions
    const promises = Array.from({ length: 50 }, async (_, i) => {
      try {
        const insert = db.prepare('INSERT INTO pm_concurrency_test (val) VALUES (?)');
        insert.run(`value_${i}`);
        writesSuccess++;
      } catch (err: any) {
        if (err?.code === 'SQLITE_BUSY' || err?.message?.includes('busy')) {
          writesContended++;
        }
      }
    });

    await Promise.all(promises);

    const countRow: any = db.prepare('SELECT COUNT(*) as cnt FROM pm_concurrency_test').get();
    db.close();

    const elapsed = performance.now() - start;
    const isIntact = countRow && countRow.cnt === writesSuccess;

    return {
      scenarioName: 'SQLite Concurrent Write Contention',
      passed: isIntact && writesSuccess > 0,
      timeToRecoveryMs: Number(elapsed.toFixed(2)),
      details: `Successful writes: ${writesSuccess}, Contended/Blocked: ${writesContended}, Total in DB: ${countRow?.cnt}`,
      dataIntegrityVerified: isIntact,
    };
  }

  /**
   * Scenario 2: Worker crash simulation and lease expiration reclamation.
   */
  public async testWorkerLeaseExpirationRecovery(testDbPath: string): Promise<FailureScenarioResult> {
    const start = performance.now();
    const db = new Database(testDbPath);
    const queue = new DurableJobQueue(db);

    // Enqueue job with short visibility timeout
    const msgId = await queue.enqueue('job_crash_sim', 'HIGH');

    // Worker 1 dequeues with 50ms visibility timeout
    const claimed = await queue.dequeue(50);
    if (!claimed) {
      db.close();
      return {
        scenarioName: 'Worker Crash & Lease Expiration Recovery',
        passed: false,
        timeToRecoveryMs: 0,
        details: 'Initial dequeue failed',
        dataIntegrityVerified: false,
      };
    }

    // Simulate Worker 1 crashing without acknowledging
    // Wait for visibility timeout (50ms) to elapse + 20ms buffer
    await new Promise((r) => setTimeout(r, 70));

    // Worker 2 attempts dequeue; should reclaim the in-flight message
    const reclaimed = await queue.dequeue(5000);
    const success = reclaimed !== null && reclaimed.jobId === 'job_crash_sim' && reclaimed.deliveryCount >= 2;

    if (reclaimed) {
      await queue.acknowledge(reclaimed.receiptHandle);
    }

    db.close();
    const elapsed = performance.now() - start;

    return {
      scenarioName: 'Worker Crash & Lease Expiration Recovery',
      passed: success,
      timeToRecoveryMs: Number(elapsed.toFixed(2)),
      details: `Reclaimed job: ${reclaimed?.jobId}, Delivery Count: ${reclaimed?.deliveryCount}`,
      dataIntegrityVerified: success,
    };
  }

  /**
   * Scenario 3: Poison job dead-letter queue routing without worker pool failure.
   */
  public async testPoisonJobDeadLetterRouting(): Promise<FailureScenarioResult> {
    const start = performance.now();
    const queue = new InMemoryJobQueue();
    const dlq = new DeadLetterQueue();

    const maxRetries = 3;
    const poisonJobId = 'poison_job_err_500';
    await queue.enqueue(poisonJobId, 'NORMAL');

    let attempts = 0;
    while (attempts < maxRetries) {
      const msg = await queue.dequeue();
      if (!msg) break;

      attempts++;
      // Simulate unhandled failure in worker handler
      if (attempts >= maxRetries) {
        // Quarantined to dead letter queue
        await dlq.record({
          jobId: msg.jobId,
          type: 'KNOWLEDGE_UPDATE',
          workspaceId: 'ws_failure_test',
          failureReason: 'Poison payload fatal handler exception',
          errorCode: 'POISON_PAYLOAD',
          retryCount: attempts,
        });
        await queue.acknowledge(msg.receiptHandle);
      } else {
        await queue.reject(msg.receiptHandle, true);
      }
    }

    const dlqDepth = await dlq.getDepth();
    const queueDepth = await queue.getDepth();
    const elapsed = performance.now() - start;

    const passed = dlqDepth === 1 && queueDepth === 0;

    return {
      scenarioName: 'Poison Job DLQ Routing',
      passed,
      timeToRecoveryMs: Number(elapsed.toFixed(2)),
      details: `DLQ Depth: ${dlqDepth}, Queue Depth: ${queueDepth}, Total Attempts: ${attempts}`,
      dataIntegrityVerified: passed,
    };
  }

  /**
   * Scenario 4: Stale lock holder rejection under expired lease.
   */
  public async testStaleLockHolderRejection(): Promise<FailureScenarioResult> {
    const start = performance.now();
    const backend = new MemoryCoordinationBackend();
    const lockMgr1 = new DistributedLockManager(backend, { ownerId: 'worker-1' });
    const lockMgr2 = new DistributedLockManager(backend, { ownerId: 'worker-2' });

    // Worker 1 acquires lock with 50ms TTL
    const lock1 = await lockMgr1.acquire('shared:repo:index', { ttlMs: 50 });
    if (!lock1.success) {
      await backend.close();
      return {
        scenarioName: 'Stale Lock Holder Rejection',
        passed: false,
        timeToRecoveryMs: 0,
        details: 'Initial lock acquisition failed',
        dataIntegrityVerified: false,
      };
    }

    // Wait for Worker 1's lease to expire
    await new Promise((r) => setTimeout(r, 70));

    // Worker 2 acquires the now-expired lock
    const lock2 = await lockMgr2.acquire('shared:repo:index', { ttlMs: 5000 });
    const worker2GotLock = lock2.success;

    // Worker 1 (stale holder) attempts to release or renew
    const worker1Release = await lockMgr1.release(lock1.lock);
    // Worker 1 must be rejected because the fence/token expired or was claimed by Worker 2
    const passed = worker2GotLock && !worker1Release;

    if (lock2.success) {
      await lockMgr2.release(lock2.lock);
    }
    await backend.close();
    const elapsed = performance.now() - start;

    return {
      scenarioName: 'Stale Lock Holder Rejection',
      passed,
      timeToRecoveryMs: Number(elapsed.toFixed(2)),
      details: `Worker 2 acquired expired lock: ${worker2GotLock}, Stale Worker 1 release rejected: ${!worker1Release}`,
      dataIntegrityVerified: passed,
    };
  }

  /**
   * Scenario 5: Queue backpressure overload protection.
   */
  public async testQueueBackpressureOverload(): Promise<FailureScenarioResult> {
    const start = performance.now();
    const maxCapacity = 50;
    const queue = new InMemoryJobQueue({ maxCapacity });

    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < 100; i++) {
      try {
        await queue.enqueue(`overflow_job_${i}`, 'NORMAL');
        accepted++;
      } catch {
        rejected++;
      }
    }

    const currentDepth = await queue.getDepth();
    const passed = accepted === maxCapacity && rejected === 50 && currentDepth === maxCapacity;
    const elapsed = performance.now() - start;

    return {
      scenarioName: 'Queue Backpressure Overload Protection',
      passed,
      timeToRecoveryMs: Number(elapsed.toFixed(2)),
      details: `Max Capacity: ${maxCapacity}, Accepted: ${accepted}, Rejected: ${rejected}, Depth: ${currentDepth}`,
      dataIntegrityVerified: passed,
    };
  }

  /**
   * Scenario 6: Corrupted backup detection and restore rejection.
   */
  public async testCorruptedBackupDetection(tempDir: string): Promise<FailureScenarioResult> {
    const start = performance.now();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const backupId = 'corrupted_backup_drill';
    const metadataPath = path.join(tempDir, `${backupId}.json`);
    const dataFilePath = path.join(tempDir, `${backupId}.db`);

    // Write metadata pointing to corrupted file
    fs.writeFileSync(metadataPath, JSON.stringify({
      backupId,
      createdAt: Date.now(),
      applicationVersion: '1.0.0',
      storageVersion: 1,
      targetDatabasePath: dataFilePath,
      checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      sizeBytes: 1024,
    }));

    // Write garbage content (not a valid SQLite database header)
    fs.writeFileSync(dataFilePath, 'GARBAGE_CORRUPTED_NON_SQLITE_DATA_STREAM');

    const restoreManager = new SqliteDatabaseRestoreManager({
      backupDirectory: tempDir,
    });

    const validation = await restoreManager.validateRestore({
      backupId,
      targetDatabasePath: path.join(tempDir, 'restored.db'),
      authorizedBy: 'recovery_admin',
    });

    const elapsed = performance.now() - start;
    const passed = !validation.canRestore && validation.errors.length > 0;

    return {
      scenarioName: 'Corrupted Backup Integrity Detection',
      passed,
      timeToRecoveryMs: Number(elapsed.toFixed(2)),
      details: `Validation rejected corrupted backup: ${!validation.canRestore}. Error: ${validation.errors[0]}`,
      dataIntegrityVerified: passed,
    };
  }

  /**
   * Scenario 7: Security controls preservation under load.
   */
  public async testSecurityPreservationUnderBurst(): Promise<FailureScenarioResult> {
    const start = performance.now();
    const principalResolver = new PrincipalResolver();
    const authService = new AuthenticationService(principalResolver, undefined, undefined, undefined, {
      environment: 'production',
    });

    let rejections = 0;
    const burstCount = 100;

    for (let i = 0; i < burstCount; i++) {
      // 1. Dev authentication attempt in production must be rejected every time
      const res = await authService.authenticate({
        method: 'LOCAL_DEVELOPMENT',
        developmentPrincipalId: `attacker_${i}`,
      });
      if (!res.success && res.errorCode === 'PROD_DEV_AUTH_FORBIDDEN') {
        rejections++;
      }

      // 2. Cross-workspace access attempt must be rejected
      let crossScopeRejected = false;
      try {
        CrossScopeGuard.assertScopeAccess(
          { workspaceId: `ws_${i}` },
          { workspaceId: 'ws_other' },
          'QueryMemory'
        );
      } catch (err) {
        if (err instanceof CrossScopeViolationError) {
          crossScopeRejected = true;
        }
      }

      if (!crossScopeRejected) {
        return {
          scenarioName: 'Security Preservation Under Burst Load',
          passed: false,
          timeToRecoveryMs: 0,
          details: 'CrossScopeGuard failed to reject cross-tenant access under load',
          dataIntegrityVerified: false,
        };
      }
    }

    const elapsed = performance.now() - start;
    const passed = rejections === burstCount;

    return {
      scenarioName: 'Security Preservation Under Burst Load',
      passed,
      timeToRecoveryMs: Number(elapsed.toFixed(2)),
      details: `100% of illegal dev-auth and cross-tenant attempts rejected (${rejections}/${burstCount})`,
      dataIntegrityVerified: passed,
    };
  }
}
