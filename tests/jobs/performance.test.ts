import { describe, it, expect } from 'vitest';
import {
  InMemoryJobQueue,
  InMemoryJobRepository,
  JobRegistry,
  JobLeaseManager,
  DeadLetterQueue,
  JobDispatcher,
  Worker,
  WorkerPool,
  type IJobHandler,
} from '../../src/jobs/index.js';

describe('Jobs - Performance & Overhead Benchmarks', () => {
  it('measures queue enqueue and dequeue throughput (10,000 items)', async () => {
    const queue = new InMemoryJobQueue({ maxCapacity: 20000 });

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      await queue.enqueue(`bench-job-${i}`, i % 2 === 0 ? 'HIGH' : 'NORMAL');
    }
    const enqueueDurationMs = performance.now() - start;

    const startDequeue = performance.now();
    let dequeued = 0;
    while (true) {
      const msg = await queue.dequeue();
      if (!msg) break;
      dequeued++;
    }
    const dequeueDurationMs = performance.now() - startDequeue;

    console.log(`[PERF] Queue Enqueue: ${enqueueDurationMs.toFixed(2)}ms for 10k items (${Math.round((10000 / enqueueDurationMs) * 1000)} ops/sec)`);
    console.log(`[PERF] Queue Dequeue: ${dequeueDurationMs.toFixed(2)}ms for 10k items (${Math.round((10000 / dequeueDurationMs) * 1000)} ops/sec)`);

    expect(dequeued).toBe(10000);
    expect(enqueueDurationMs).toBeLessThan(1500);
    expect(dequeueDurationMs).toBeLessThan(3000);
  });

  it('measures dispatch and repository persistence overhead (1,000 jobs)', async () => {
    const queue = new InMemoryJobQueue();
    const repo = new InMemoryJobRepository();
    const dispatcher = new JobDispatcher(queue, repo);

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await dispatcher.dispatch({
        type: 'KNOWLEDGE_UPDATE',
        workspaceId: 'ws-perf',
        payload: { index: i },
      });
    }
    const durationMs = performance.now() - start;

    console.log(`[PERF] Dispatcher Throughput: ${durationMs.toFixed(2)}ms for 1k jobs (${Math.round((1000 / durationMs) * 1000)} jobs/sec)`);
    expect(durationMs).toBeLessThan(1000);
    expect(await queue.getDepth()).toBe(1000);
  });

  it('measures worker execution throughput across worker pool (500 jobs)', async () => {
    const queue = new InMemoryJobQueue();
    const repo = new InMemoryJobRepository();
    const registry = new JobRegistry();
    const leaseManager = new JobLeaseManager();
    const deadLetterQueue = new DeadLetterQueue();
    const dispatcher = new JobDispatcher(queue, repo);

    registry.register('MAINTENANCE', {
      validate: () => {},
      execute: async () => ({}),
    });

    for (let i = 0; i < 500; i++) {
      await dispatcher.dispatch({
        type: 'MAINTENANCE',
        workspaceId: 'ws-pool',
        payload: { i },
      });
    }

    const pool = new WorkerPool(queue, repo, registry, leaseManager, deadLetterQueue, {
      concurrency: 4,
      workerOptions: { pollIntervalMs: 5 },
    });

    const start = performance.now();
    await pool.start();

    // Wait until queue is empty and jobs complete
    while ((await queue.getDepth()) > 0) {
      await new Promise((r) => setTimeout(r, 20));
    }

    await pool.stop(100);
    const durationMs = performance.now() - start;

    console.log(`[PERF] WorkerPool Throughput: ${durationMs.toFixed(2)}ms for 500 executed jobs (${Math.round((500 / durationMs) * 1000)} jobs/sec)`);
    expect(durationMs).toBeLessThan(3000);
  });
});
