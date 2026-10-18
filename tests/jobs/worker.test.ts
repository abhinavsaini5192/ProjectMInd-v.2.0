import { describe, it, expect, beforeEach } from 'vitest';
import {
  Worker,
  InMemoryJobQueue,
  InMemoryJobRepository,
  JobRegistry,
  JobLeaseManager,
  DeadLetterQueue,
  JobDispatcher,
  type IJobHandler,
} from '../../src/jobs/index.js';

describe('Jobs - Worker Execution, Timeouts, and Dependencies', () => {
  let queue: InMemoryJobQueue;
  let repository: InMemoryJobRepository;
  let registry: JobRegistry;
  let leaseManager: JobLeaseManager;
  let deadLetterQueue: DeadLetterQueue;
  let dispatcher: JobDispatcher;
  let worker: Worker;

  beforeEach(() => {
    queue = new InMemoryJobQueue();
    repository = new InMemoryJobRepository();
    registry = new JobRegistry();
    leaseManager = new JobLeaseManager();
    deadLetterQueue = new DeadLetterQueue();
    dispatcher = new JobDispatcher(queue, repository);

    worker = new Worker(queue, repository, registry, leaseManager, deadLetterQueue, {
      workerId: 'test-worker-1',
      leaseTtlMs: 5000,
    });
  });

  it('successfully executes job and transitions status to COMPLETED', async () => {
    let executed = false;
    const testHandler: IJobHandler<{ value: number }> = {
      validate: (job) => {
        expect(job.payload.value).toBe(42);
      },
      execute: async (job, context) => {
        executed = true;
        await context.updateProgress(50, 100, 'Halfway');
        return {
          data: { result: job.payload.value * 2 },
          metrics: { computationMs: 5 },
        };
      },
    };

    registry.register('KNOWLEDGE_UPDATE', testHandler);

    const job = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-1',
      payload: { value: 42 },
    });

    const processed = await worker.processNext();
    expect(processed).toBe(true);
    expect(executed).toBe(true);

    const finishedJob = await repository.getById(job.jobId);
    expect(finishedJob?.status).toBe('COMPLETED');
    expect(finishedJob?.completedAt).toBeDefined();
    expect(finishedJob?.result?.data?.['result']).toBe(84);
    expect(finishedJob?.progress?.percentage).toBe(50);
  });

  it('fails safely and routes unknown job types to DeadLetterQueue', async () => {
    const job = await dispatcher.dispatch({
      type: 'UNKNOWN',
      workspaceId: 'ws-1',
      payload: {},
    });

    const processed = await worker.processNext();
    expect(processed).toBe(true);

    const finishedJob = await repository.getById(job.jobId);
    expect(finishedJob?.status).toBe('DEAD_LETTERED');
    expect(finishedJob?.error?.code).toBe('UNKNOWN_JOB_TYPE');

    const dl = await deadLetterQueue.get(job.jobId);
    expect(dl).toBeDefined();
    expect(dl?.failureReason).toContain("No handler registered for job type 'UNKNOWN'");
  });

  it('enforces job timeout and aborts signal when execution exceeds limit', async () => {
    const slowHandler: IJobHandler = {
      validate: () => {},
      execute: async (_job, context) => {
        // Sleep longer than timeout
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (context.signal.aborted) {
          throw new Error('Aborted by timeout');
        }
        return {};
      },
    };

    registry.register('MAINTENANCE', slowHandler);

    const job = await dispatcher.dispatch({
      type: 'MAINTENANCE',
      workspaceId: 'ws-1',
      payload: {},
      timeoutMs: 100, // 100ms timeout
      maxRetries: 0,
    });

    const processed = await worker.processNext();
    expect(processed).toBe(true);

    const finishedJob = await repository.getById(job.jobId);
    expect(finishedJob?.status).toBe('DEAD_LETTERED');
    expect(finishedJob?.error?.code).toBe('JOB_TIMEOUT');
  });

  it('honors predecessor dependencies before executing a dependent job', async () => {
    let executedDependent = false;
    registry.register('FEATURE_DISCOVERY', {
      validate: () => {},
      execute: async () => {
        executedDependent = true;
        return {};
      },
    });

    // 1. Dispatch predecessor job (not yet completed)
    const predJob = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-1',
      payload: {},
    });

    // 2. Dispatch dependent job requiring predJob
    const depJob = await dispatcher.dispatch({
      type: 'FEATURE_DISCOVERY',
      workspaceId: 'ws-1',
      payload: {},
      dependencies: [predJob.jobId],
    });

    // Worker attempts to process queue (first dequeue is predJob or depJob)
    // If it gets depJob first, it must requeue it because predJob is not COMPLETED
    const p1 = await worker.processNext();
    expect(p1).toBe(true);

    const depCheck1 = await repository.getById(depJob.jobId);
    // depJob cannot be COMPLETED yet
    expect(depCheck1?.status).not.toBe('COMPLETED');
  });
});
