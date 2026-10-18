import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../../src/reliability/resilience/CircuitBreaker.js';

describe('Reliability - CircuitBreaker', () => {
  it('starts in CLOSED state and passes successful executions', async () => {
    const cb = new CircuitBreaker('test-service', { failureThreshold: 3 });
    expect(cb.getState()).toBe('CLOSED');

    const result = await cb.execute(async () => 'ok');
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('trips to OPEN state when consecutive failures reach threshold', async () => {
    const cb = new CircuitBreaker('test-db', { failureThreshold: 2, recoveryTimeoutMs: 1000 });

    // Failure 1
    await expect(
      cb.execute(async () => {
        throw new Error('db timeout');
      })
    ).rejects.toThrow('db timeout');
    expect(cb.getState()).toBe('CLOSED');

    // Failure 2 -> triggers OPEN
    await expect(
      cb.execute(async () => {
        throw new Error('db timeout');
      })
    ).rejects.toThrow('db timeout');
    expect(cb.getState()).toBe('OPEN');

    // Subsequent calls fast-fail with CircuitOpenError without invoking action
    let invoked = false;
    await expect(
      cb.execute(async () => {
        invoked = true;
        return 'value';
      })
    ).rejects.toThrow(CircuitOpenError);
    expect(invoked).toBe(false);
  });

  it('transitions from OPEN to HALF_OPEN after recoveryTimeout expires and probes', async () => {
    const cb = new CircuitBreaker('test-api', {
      failureThreshold: 1,
      recoveryTimeoutMs: 50,
      halfOpenProbeCount: 2,
    });

    await expect(
      cb.execute(async () => {
        throw new Error('API outage');
      })
    ).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Wait for recovery timeout
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cb.getState()).toBe('HALF_OPEN');

    // First successful probe in HALF_OPEN
    await cb.execute(async () => 'probe-1');
    expect(cb.getState()).toBe('HALF_OPEN');

    // Second successful probe satisfies halfOpenProbeCount -> closes circuit
    await cb.execute(async () => 'probe-2');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('trips back to OPEN immediately if a probe fails during HALF_OPEN', async () => {
    const cb = new CircuitBreaker('test-cache', {
      failureThreshold: 1,
      recoveryTimeoutMs: 30,
      halfOpenProbeCount: 2,
    });

    await expect(
      cb.execute(async () => {
        throw new Error('fail 1');
      })
    ).rejects.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(cb.getState()).toBe('HALF_OPEN');

    // Failing probe trips it back to OPEN immediately
    await expect(
      cb.execute(async () => {
        throw new Error('probe failed');
      })
    ).rejects.toThrow('probe failed');

    expect(cb.getState()).toBe('OPEN');
  });

  it('supports manual trip and reset operations', async () => {
    const cb = new CircuitBreaker('manual-test');
    expect(cb.getState()).toBe('CLOSED');

    cb.trip();
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    const val = await cb.execute(async () => 42);
    expect(val).toBe(42);
  });
});
