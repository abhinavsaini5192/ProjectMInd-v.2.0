import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../src/reliability/resilience/CircuitBreaker.js';
import { FailureClassifier } from '../../src/reliability/failure/FailureClassifier.js';
import { ReliabilityTelemetry } from '../../src/reliability/observability/ReliabilityTelemetry.js';

describe('Reliability - Stress & Concurrency Resilience', () => {
  it('handles high concurrent throughput through CircuitBreaker without corruption', async () => {
    const cb = new CircuitBreaker('high-throughput-service', {
      failureThreshold: 100,
      recoveryTimeoutMs: 50,
    });

    const concurrency = 2000;
    const promises: Promise<number>[] = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(cb.execute(async () => i * 2));
    }

    const results = await Promise.all(promises);
    expect(results).toHaveLength(concurrency);
    expect(results[0]).toBe(0);
    expect(results[1999]).toBe(3998);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('performs > 10,000 failure classifications with sub-millisecond determinism', () => {
    const classifier = new FailureClassifier();
    const errors = [
      new Error('connect ECONNREFUSED'),
      new Error('Permission denied: invalid token'),
      new Error('Validation failed for field "name"'),
      new Error('Checksum mismatch in chunk 4'),
      new Error('Request aborted due to timeout'),
    ];

    const t0 = Date.now();
    const count = 10000;

    for (let i = 0; i < count; i++) {
      const err = errors[i % errors.length]!;
      const rec = classifier.classify(err);
      expect(rec.category).toBeDefined();
    }

    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(1000); // 10k classifications well under 1 second
  });

  it('handles rapid degradation changes and concurrent health status aggregation', () => {
    const telemetry = new ReliabilityTelemetry();

    for (let i = 0; i < 50; i++) {
      telemetry.recordDegradation(`service-${i % 5}`, i % 2 === 0);
      telemetry.recordCircuitState(`circuit-${i % 3}`, i % 3 === 0 ? 'OPEN' : 'CLOSED');
    }

    const report = telemetry.getHealthReport();
    expect(report.state).toBe('DEGRADED');
    expect(report.activeDegradations.length).toBeGreaterThan(0);
  });
});
