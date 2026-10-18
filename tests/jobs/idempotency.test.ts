import { describe, it, expect, beforeEach } from 'vitest';
import {
  JobDispatcher,
  InMemoryJobQueue,
  InMemoryJobRepository,
} from '../../src/jobs/index.js';

describe('Jobs - Idempotency & Deduplication', () => {
  let queue: InMemoryJobQueue;
  let repository: InMemoryJobRepository;
  let dispatcher: JobDispatcher;

  beforeEach(() => {
    queue = new InMemoryJobQueue();
    repository = new InMemoryJobRepository();
    dispatcher = new JobDispatcher(queue, repository);
  });

  it('deduplicates identical jobs submitted with the same idempotencyKey in the same workspace', async () => {
    const job1 = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-1',
      idempotencyKey: 'idemp-tx-12345',
      payload: { repo: 'mind', update: 1 },
    });

    const job2 = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-1',
      idempotencyKey: 'idemp-tx-12345',
      payload: { repo: 'mind', update: 1 },
    });

    // Same job ID returned
    expect(job1.jobId).toBe(job2.jobId);
    expect(await queue.getDepth()).toBe(1); // Only 1 job enqueued!
  });

  it('allows identical idempotency keys in DIFFERENT workspaces without collision', async () => {
    const jobWs1 = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'workspace-alpha',
      idempotencyKey: 'idemp-same-key',
      payload: { repo: 'repo-a' },
    });

    const jobWs2 = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'workspace-beta',
      idempotencyKey: 'idemp-same-key',
      payload: { repo: 'repo-b' },
    });

    expect(jobWs1.jobId).not.toBe(jobWs2.jobId);
    expect(await queue.getDepth()).toBe(2);
  });
});
