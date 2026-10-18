import { describe, it, expect, beforeEach } from 'vitest';
import {
  JobLeaseManager,
  JobRecoveryManager,
  InMemoryJobQueue,
  InMemoryJobRepository,
  DeadLetterQueue,
  JobDispatcher,
} from '../../src/jobs/index.js';

describe('Jobs - Lease Management & Worker Crash Recovery', () => {
  let leaseManager: JobLeaseManager;
  let queue: InMemoryJobQueue;
  let repository: InMemoryJobRepository;
  let deadLetterQueue: DeadLetterQueue;
  let recoveryManager: JobRecoveryManager;
  let dispatcher: JobDispatcher;

  beforeEach(() => {
    leaseManager = new JobLeaseManager();
    queue = new InMemoryJobQueue();
    repository = new InMemoryJobRepository();
    deadLetterQueue = new DeadLetterQueue();
    recoveryManager = new JobRecoveryManager(leaseManager, queue, deadLetterQueue, repository);
    dispatcher = new JobDispatcher(queue, repository);
  });

  it('acquires, renews, and releases worker leases', async () => {
    const acquired = await leaseManager.acquireLease('job-1', 'worker-A', 500);
    expect(acquired).toBe(true);

    // Another worker cannot acquire active lease
    const conflict = await leaseManager.acquireLease('job-1', 'worker-B', 500);
    expect(conflict).toBe(false);

    expect(await leaseManager.getLeaseHolder('job-1')).toBe('worker-A');

    // Worker A renews lease
    const renewed = await leaseManager.renewLease('job-1', 'worker-A', 1000);
    expect(renewed).toBe(true);

    // Worker A releases lease
    const released = await leaseManager.releaseLease('job-1', 'worker-A');
    expect(released).toBe(true);

    expect(await leaseManager.getLeaseHolder('job-1')).toBeNull();
  });

  it('recovers crashed worker running jobs when their lease expires', async () => {
    const job = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-1',
      payload: {},
      maxRetries: 2,
    });

    // Simulate worker acquiring lease and setting status to RUNNING with short TTL (50ms)
    await repository.update(job.jobId, { status: 'RUNNING' });
    await leaseManager.acquireLease(job.jobId, 'crashed-worker-1', 50);

    // Wait for lease to expire
    await new Promise((r) => setTimeout(r, 60));

    // Recovery runs
    const recoveryResult = await recoveryManager.recoverStaleJobs();
    expect(recoveryResult.recoveredCount).toBe(1);
    expect(recoveryResult.deadLetteredCount).toBe(0);

    const recoveredJob = await repository.getById(job.jobId);
    expect(recoveredJob?.status).toBe('QUEUED');
    expect(recoveredJob?.retryCount).toBe(1);
  });

  it('routes to DeadLetterQueue if crashed job has exhausted max retries', async () => {
    const job = await dispatcher.dispatch({
      type: 'INTEGRITY_CHECK',
      workspaceId: 'ws-1',
      payload: {},
      maxRetries: 1,
    });

    // Simulate already retried once
    await repository.update(job.jobId, { status: 'RUNNING', retryCount: 1 });
    await leaseManager.acquireLease(job.jobId, 'crashed-worker-2', 50);

    await new Promise((r) => setTimeout(r, 60));

    const recoveryResult = await recoveryManager.recoverStaleJobs();
    expect(recoveryResult.deadLetteredCount).toBe(1);

    const finalJob = await repository.getById(job.jobId);
    expect(finalJob?.status).toBe('DEAD_LETTERED');
    expect(await deadLetterQueue.get(job.jobId)).toBeDefined();
  });
});
