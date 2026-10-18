import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryJobQueue, JobError } from '../../src/jobs/index.js';

describe('Jobs - InMemoryJobQueue', () => {
  let queue: InMemoryJobQueue;

  beforeEach(() => {
    queue = new InMemoryJobQueue({
      maxCapacity: 5,
      defaultVisibilityTimeoutMs: 100,
    });
  });

  it('enqueues and dequeues messages in priority order', async () => {
    await queue.enqueue('job-low', 'LOW');
    await queue.enqueue('job-critical', 'CRITICAL');
    await queue.enqueue('job-normal', 'NORMAL');

    const msg1 = await queue.dequeue();
    expect(msg1?.jobId).toBe('job-critical');

    const msg2 = await queue.dequeue();
    expect(msg2?.jobId).toBe('job-normal');

    const msg3 = await queue.dequeue();
    expect(msg3?.jobId).toBe('job-low');

    const empty = await queue.dequeue();
    expect(empty).toBeNull();
  });

  it('acknowledges messages and removes them from in-flight tracking', async () => {
    await queue.enqueue('job-1');
    const msg = await queue.dequeue();
    expect(msg).toBeDefined();

    const acked = await queue.acknowledge(msg!.receiptHandle);
    expect(acked).toBe(true);

    // Double acknowledge returns false
    const doubleAck = await queue.acknowledge(msg!.receiptHandle);
    expect(doubleAck).toBe(false);
  });

  it('rejects and requeues messages back into queue', async () => {
    await queue.enqueue('job-retry');
    const msg = await queue.dequeue();
    expect(msg).toBeDefined();

    const rejected = await queue.reject(msg!.receiptHandle, true);
    expect(rejected).toBe(true);

    const reDequeued = await queue.dequeue();
    expect(reDequeued?.jobId).toBe('job-retry');
    expect(reDequeued?.deliveryCount).toBe(2);
  });

  it('re-queues with delay so message is hidden until visibleAfterMs passes', async () => {
    await queue.enqueue('job-delayed');
    const msg = await queue.dequeue();
    expect(msg).toBeDefined();

    await queue.requeue(msg!.receiptHandle, 200);

    // Immediately dequeue: should be hidden
    const immediate = await queue.dequeue();
    expect(immediate).toBeNull();

    // After delay: should be visible
    await new Promise((r) => setTimeout(r, 250));
    const ready = await queue.dequeue();
    expect(ready?.jobId).toBe('job-delayed');
  });

  it('enforces max capacity and throws backpressure JobError when full', async () => {
    for (let i = 0; i < 5; i++) {
      await queue.enqueue(`job-${i}`);
    }

    expect(await queue.getDepth()).toBe(5);

    // 6th enqueue exceeds limit
    await expect(queue.enqueue('job-overflow')).rejects.toThrowError(JobError);
  });
});
