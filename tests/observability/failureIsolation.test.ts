import { describe, it, expect } from 'vitest';
import {
  BoundedTelemetryQueue,
  TelemetryCircuitBreaker,
  safeTelemetryExecution,
} from '../../src/observability/index.js';

describe('Observability - Telemetry Failure Isolation & Backpressure', () => {
  it('enforces queue max size and drops oldest items when policy is DROP_OLDEST', () => {
    const queue = new BoundedTelemetryQueue<string>({
      maxSize: 3,
      dropPolicy: 'DROP_OLDEST',
    });

    queue.enqueue('item-1');
    queue.enqueue('item-2');
    queue.enqueue('item-3');
    expect(queue.size()).toBe(3);

    // Overflow by 1
    queue.enqueue('item-4');
    expect(queue.size()).toBe(3);

    const stats = queue.getStats();
    expect(stats.totalDropped).toBe(1);
    expect(stats.totalEnqueued).toBe(4);

    const drained = queue.drain();
    expect(drained).toEqual(['item-2', 'item-3', 'item-4']);
  });

  it('enforces queue max size and rejects new items when policy is DROP_NEWEST', () => {
    const queue = new BoundedTelemetryQueue<string>({
      maxSize: 3,
      dropPolicy: 'DROP_NEWEST',
    });

    queue.enqueue('item-1');
    queue.enqueue('item-2');
    queue.enqueue('item-3');

    const accepted = queue.enqueue('item-4');
    expect(accepted).toBe(false);
    expect(queue.size()).toBe(3);

    const stats = queue.getStats();
    expect(stats.totalDropped).toBe(1);

    const drained = queue.drain();
    expect(drained).toEqual(['item-1', 'item-2', 'item-3']);
  });

  it('opens circuit breaker after repeated failures to protect application', async () => {
    const breaker = new TelemetryCircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    });

    expect(breaker.getState()).toBe('CLOSED');

    const failingSink = async () => {
      throw new Error('Remote metrics collector unavailable');
    };

    // Execute 3 failing calls
    await breaker.execute(failingSink, null);
    await breaker.execute(failingSink, null);
    await breaker.execute(failingSink, null);

    // Circuit is now OPEN
    expect(breaker.getState()).toBe('OPEN');

    let invoked = false;
    const result = await breaker.execute(async () => {
      invoked = true;
      return 'success';
    }, 'fallback-val');

    expect(invoked).toBe(false); // Short-circuited!
    expect(result).toBe('fallback-val');
  });

  it('safeTelemetryExecution prevents uncaught telemetry errors from disrupting domain code', () => {
    const result = safeTelemetryExecution(() => {
      throw new Error('Telemetry serialization crashed');
    }, 'safe_fallback');

    expect(result).toBe('safe_fallback');
  });
});
