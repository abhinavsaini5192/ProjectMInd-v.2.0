import { describe, it, expect, beforeEach } from 'vitest';
import {
  Worker,
  InMemoryJobQueue,
  InMemoryJobRepository,
  JobRegistry,
  JobLeaseManager,
  DeadLetterQueue,
  JobDispatcher,
  computeBackoffDelay,
  JobError,
  type IJobHandler,
} from '../../src/jobs/index.js';

describe('Jobs - Retries, Backoff, and Dead-Letter Queue', () => {
  let queue: InMemoryJobQueue;
  let repository: InMemoryJobRepository;
  let registry: JobRegistry;
  let leaseManager: JobLeaseManager;
  let deadLetterQueue: DeadLetterQueue;
  let dispatcher: JobDispatcher;

  beforeEach(() => {
    queue = new InMemoryJobQueue();
    repository = new InMemoryJobRepository();
    registry = new JobRegistry();
    leaseManager = new JobLeaseManager();
    deadLetterQueue = new DeadLetterQueue();
    dispatcher = new JobDispatcher(queue, repository);
  });

  it('computes exponential backoff with jitter within bounded limits', () => {
    const delay0 = computeBackoffDelay(0, 1000, 30000);
    expect(delay0).toBe(0);

    const delay1 = computeBackoffDelay(1, 1000, 30000, 'EXPONENTIAL');
    expect(delay1).toBe(1000);

    const delay2 = computeBackoffDelay(2, 1000, 30000, 'EXPONENTIAL');
    expect(delay2).toBe(2000);

    const delay3 = computeBackoffDelay(3, 1000, 30000, 'EXPONENTIAL');
    expect(delay3).toBe(4000);

    // Clamped at maxDelayMs
    const delayMax = computeBackoffDelay(10, 1000, 5000, 'EXPONENTIAL');
    expect(delayMax).toBe(5000);

    // Jitter is between 50% and 100% of base
    const delayJitter = computeBackoffDelay(2, 1000, 30000, 'EXPONENTIAL_WITH_JITTER');
    expect(delayJitter).toBeGreaterThanOrEqual(1000);
    expect(delayJitter).toBeLessThanOrEqual(2000);
  });

  it('retries a retryable error and increments retryCount', async () => {
    let callCount = 0;
    const retryableHandler: IJobHandler = {
      validate: () => {},
      execute: async () => {
        callCount++;
        throw new JobError('QUEUE_UNAVAILABLE', 'Database temporarily locked', true);
      },
    };

    registry.register('KNOWLEDGE_UPDATE', retryableHandler);

    const worker = new Worker(queue, repository, registry, leaseManager, deadLetterQueue, {
      retryPolicy: {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffStrategy: 'FIXED',
        isRetryable: () => true,
      },
    });

    const job = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-1',
      payload: {},
      maxRetries: 3,
    });

    // 1st attempt fails -> RETRY_PENDING
    await worker.processNext();
    const jobAfterFail1 = await repository.getById(job.jobId);
    expect(jobAfterFail1?.status).toBe('RETRY_PENDING');
    expect(jobAfterFail1?.retryCount).toBe(1);
    expect(callCount).toBe(1);

    // Wait for fixed delay
    await new Promise((r) => setTimeout(r, 20));

    // 2nd attempt fails -> RETRY_PENDING with retryCount=2
    await worker.processNext();
    const jobAfterFail2 = await repository.getById(job.jobId);
    expect(jobAfterFail2?.retryCount).toBe(2);
    expect(callCount).toBe(2);
  });

  it('routes directly to DeadLetterQueue when error is non-retryable', async () => {
    const nonRetryableHandler: IJobHandler = {
      validate: () => {
        throw new JobError('JOB_AUTHORIZATION_FAILED', 'User lacks scope', false);
      },
      execute: async () => ({}),
    };

    registry.register('DATA_LIFECYCLE', nonRetryableHandler);

    const worker = new Worker(queue, repository, registry, leaseManager, deadLetterQueue, {
      retryPolicy: {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffStrategy: 'FIXED',
        isRetryable: (err) => err instanceof JobError && err.retryable,
      },
    });

    const job = await dispatcher.dispatch({
      type: 'DATA_LIFECYCLE',
      workspaceId: 'ws-1',
      payload: {},
      maxRetries: 3,
    });

    await worker.processNext();

    const deadJob = await repository.getById(job.jobId);
    expect(deadJob?.status).toBe('DEAD_LETTERED');
    expect(deadJob?.retryCount).toBe(0); // Did not attempt retries!

    const dlRecord = await deadLetterQueue.get(job.jobId);
    expect(dlRecord).toBeDefined();
    expect(dlRecord?.failureReason).toContain('User lacks scope');
    expect(dlRecord?.errorCode).toBe('JOB_AUTHORIZATION_FAILED');
  });

  it('routes to DeadLetterQueue when max retries are exhausted', async () => {
    const alwaysFailHandler: IJobHandler = {
      validate: () => {},
      execute: async () => {
        throw new JobError('INTERNAL_JOB_ERROR', 'Network glitch', true);
      },
    };

    registry.register('INTEGRITY_CHECK', alwaysFailHandler);

    const worker = new Worker(queue, repository, registry, leaseManager, deadLetterQueue, {
      retryPolicy: {
        maxRetries: 1,
        initialDelayMs: 5,
        maxDelayMs: 20,
        backoffStrategy: 'FIXED',
        isRetryable: () => true,
      },
    });

    const job = await dispatcher.dispatch({
      type: 'INTEGRITY_CHECK',
      workspaceId: 'ws-1',
      payload: {},
      maxRetries: 1, // Only 1 retry allowed
    });

    // Attempt 1: retryable fail -> RETRY_PENDING, retryCount=1
    await worker.processNext();
    expect((await repository.getById(job.jobId))?.status).toBe('RETRY_PENDING');

    await new Promise((r) => setTimeout(r, 10));

    // Attempt 2: retryCount reaches maxRetries (1) -> DEAD_LETTERED
    await worker.processNext();
    const finalJob = await repository.getById(job.jobId);
    expect(finalJob?.status).toBe('DEAD_LETTERED');
    expect(await deadLetterQueue.get(job.jobId)).toBeDefined();
  });
});
