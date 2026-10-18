import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkerPool,
  InMemoryJobQueue,
  InMemoryJobRepository,
  JobRegistry,
  JobLeaseManager,
  DeadLetterQueue,
  JobDispatcher,
  type IJobHandler,
} from '../../src/jobs/index.js';

describe('Jobs - WorkerPool & Concurrency Management', () => {
  let queue: InMemoryJobQueue;
  let repository: InMemoryJobRepository;
  let registry: JobRegistry;
  let leaseManager: JobLeaseManager;
  let deadLetterQueue: DeadLetterQueue;
  let dispatcher: JobDispatcher;
  let pool: WorkerPool;

  beforeEach(() => {
    queue = new InMemoryJobQueue();
    repository = new InMemoryJobRepository();
    registry = new JobRegistry();
    leaseManager = new JobLeaseManager();
    deadLetterQueue = new DeadLetterQueue();
    dispatcher = new JobDispatcher(queue, repository);

    pool = new WorkerPool(queue, repository, registry, leaseManager, deadLetterQueue, {
      concurrency: 3,
      maxPerWorkspace: 2,
    });
  });

  it('initializes pool with configured concurrency and reports stats', () => {
    const stats = pool.getStats();
    expect(stats.totalWorkers).toBe(3);
    expect(stats.maxConcurrency).toBe(3);
    expect(stats.maxPerWorkspace).toBe(2);
    expect(pool.getWorkerInfos()).toHaveLength(3);
  });

  it('processes multiple jobs concurrently through worker pool', async () => {
    let completedJobs = 0;
    const testHandler: IJobHandler = {
      validate: () => {},
      execute: async () => {
        await new Promise((r) => setTimeout(r, 20));
        completedJobs++;
        return {};
      },
    };

    registry.register('KNOWLEDGE_UPDATE', testHandler);

    // Dispatch 5 jobs
    for (let i = 0; i < 5; i++) {
      await dispatcher.dispatch({
        type: 'KNOWLEDGE_UPDATE',
        workspaceId: 'ws-1',
        payload: { item: i },
      });
    }

    await pool.start();

    // Wait for all to finish
    const startWait = Date.now();
    while (completedJobs < 5 && Date.now() - startWait < 3000) {
      await new Promise((r) => setTimeout(r, 50));
    }

    await pool.stop(100);

    expect(completedJobs).toBe(5);
  });
});
