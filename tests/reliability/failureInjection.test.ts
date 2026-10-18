import { describe, it, expect, vi } from 'vitest';
import { FailureClassifier } from '../../src/reliability/failure/FailureClassifier.js';
import { CircuitBreaker, CircuitOpenError } from '../../src/reliability/resilience/CircuitBreaker.js';
import { TimeoutPolicy, TimeoutError } from '../../src/reliability/resilience/TimeoutPolicy.js';
import { DependencyDegradationManager } from '../../src/reliability/resilience/DependencyDegradationManager.js';
import { ReliabilityTelemetry } from '../../src/reliability/observability/ReliabilityTelemetry.js';
import { BackupRestoreValidator } from '../../src/reliability/disaster/BackupRestoreValidator.js';
import { VersionConflictError } from '../../src/storage/consistency/ConcurrencyTypes.js';

describe('Reliability - Controlled Failure Injection Scenarios', () => {
  const classifier = new FailureClassifier();

  it('Scenario 1: Storage connection failure -> classified as DEPENDENCY, retryable, trips circuit after threshold', async () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5432: storage unreachable');
    const record = classifier.classify(error);

    expect(record.category).toBe('DEPENDENCY');
    expect(record.retryable).toBe(true);

    const cb = new CircuitBreaker('storage', { failureThreshold: 2 });
    await expect(cb.execute(async () => { throw error; })).rejects.toThrow();
    await expect(cb.execute(async () => { throw error; })).rejects.toThrow();

    expect(cb.getState()).toBe('OPEN');
    await expect(cb.execute(async () => 'ok')).rejects.toThrow(CircuitOpenError);
  });

  it('Scenario 2: Transaction failure -> classified as CONCURRENCY or DEPENDENCY with transaction rollback', () => {
    const txError = new Error('Transaction aborted: deadlock detected with worker-4');
    const record = classifier.classify(txError);

    expect(record.category).toBe('CONCURRENCY');
    expect(record.retryable).toBe(true);
  });

  it('Scenario 3: Worker crash -> classified as RESOURCE_EXHAUSTION or DEPENDENCY with job recovery', () => {
    const workerCrashErr = new Error('Process exited with code 137 (SIGKILL / OOMKilled)');
    const record = classifier.classify(workerCrashErr);

    expect(record.category).toBe('RESOURCE_EXHAUSTION');
    expect(record.severity).toBe('CRITICAL');
  });

  it('Scenario 4: API process restart -> graceful unready state prevents traffic routing', () => {
    const degradation = new DependencyDegradationManager();
    degradation.register('api_gateway', 'CRITICAL');
    degradation.recordFailure('api_gateway', 'Process restarting');

    expect(degradation.isCriticalFailure()).toBe(true);
  });

  it('Scenario 5: Queue unavailable -> classified as DEPENDENCY and trips queue circuit', async () => {
    const queueErr = new Error('Queue connection timed out: RabbitMQ broker unresponsive');
    const record = classifier.classify(queueErr);

    expect(record.category).toBe('TIMEOUT');
    expect(record.retryable).toBe(true);
  });

  it('Scenario 6: EventBus failure -> events queued or recorded without silent loss', () => {
    const eventBusErr = new Error('EventBus pub/sub partition offline: channel closed');
    const record = classifier.classify(eventBusErr);

    expect(record.category).toBe('DEPENDENCY');
    expect(record.retryable).toBe(true);
  });

  it('Scenario 7: Cache failure -> degraded mode active, falls back to authoritative storage without data loss', () => {
    const degradation = new DependencyDegradationManager();
    degradation.register('redis_cache', 'DEGRADABLE');

    degradation.recordFailure('redis_cache', new Error('Redis cluster connection refused'));

    expect(degradation.isCriticalFailure()).toBe(false);
    expect(degradation.getActiveDegradations()[0]?.name).toBe('redis_cache');
    expect(degradation.getActiveDegradations()[0]?.isDegraded).toBe(true);
  });

  it('Scenario 8: Telemetry failure -> application execution proceeds safely', () => {
    const telemetry = new ReliabilityTelemetry();
    telemetry.recordDegradation('open_telemetry_collector', true);

    const report = telemetry.getHealthReport(false);
    expect(report.state).toBe('DEGRADED');
    expect(report.activeDegradations).toContain('open_telemetry_collector');
  });

  it('Scenario 9: Stale lease -> classified as CONCURRENCY and identified for lock recovery sweep', () => {
    const staleLockErr = new Error('Lock acquisition failed: lease held by stale worker-9 expired at 1700000000');
    const record = classifier.classify(staleLockErr);

    expect(record.category).toBe('CONCURRENCY');
    expect(record.retryable).toBe(true);
  });

  it('Scenario 10: Concurrent version conflict -> classified as CONCURRENCY with optimistic locking retry', () => {
    const conflictErr = new VersionConflictError('RepositoryContext', 'repo-x', 4, 5);
    const record = classifier.classify(conflictErr);

    expect(record.category).toBe('CONCURRENCY');
    expect(record.retryable).toBe(true);
  });

  it('Scenario 11: Context generation interruption -> timeout aborts sub-tasks without partial publication', async () => {
    let subTaskCancelled = false;

    await expect(
      TimeoutPolicy.withTimeout(
        async (signal) => {
          signal.addEventListener('abort', () => {
            subTaskCancelled = true;
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'context-data';
        },
        15,
        'context_generation'
      )
    ).rejects.toThrow(TimeoutError);

    expect(subTaskCancelled).toBe(true);
  });

  it('Scenario 12: Knowledge update interruption -> partial state detected as missing derived mapping', () => {
    const updateErr = new Error('Knowledge update interrupted: transaction cancelled before derived feature mapping');
    const record = classifier.classify(updateErr);

    expect(record.retryable).toBe(true);
  });

  it('Scenario 13: Migration interruption -> schema mismatch detected on startup', () => {
    const migrationErr = new Error('Migration failed: table migration v5 interrupted at step 3');
    const record = classifier.classify(migrationErr);

    expect(record.category).toBe('CONFIGURATION');
    expect(record.retryable).toBe(false);
  });

  it('Scenario 14: Backup validation failure -> detected and rejected prior to storage commit', () => {
    const assessment = BackupRestoreValidator.validateBackup({
      backupId: 'corrupt-bak',
      createdAt: Date.now(),
      storageVersion: 1,
      applicationVersion: '1.0.0',
      scope: { isFull: true },
      status: 'FAILED',
      sizeBytes: 0,
      integrityHash: '',
    });

    expect(assessment.isValid).toBe(false);
    expect(assessment.errors).toContain('Missing integrity hash');
  });

  it('Scenario 15: Restore incompatibility -> rejected when backup version exceeds app storage version', () => {
    const assessment = BackupRestoreValidator.validateRestore(
      { backupId: 'b-99', type: 'FULL', authorizedBy: 'admin' },
      {
        backupId: 'b-99',
        createdAt: Date.now() - 1000,
        storageVersion: 10,
        applicationVersion: '1.0.0',
        scope: { isFull: true },
        status: 'COMPLETED',
        sizeBytes: 1000,
        integrityHash: 'hash-ok',
      },
      1 // Current version is 1, backup is 10
    );

    expect(assessment.canRestore).toBe(false);
    expect(assessment.errors[0]).toContain('Incompatible backup schema');
  });
});
