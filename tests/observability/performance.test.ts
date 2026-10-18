import { describe, it, expect } from 'vitest';
import {
  ObservabilityLogger,
  MetricsRegistry,
  Tracer,
  HealthManager,
  DiagnosticManager,
  CorrelationContext,
} from '../../src/observability/index.js';

describe('Observability - Performance & Overhead Measurements', () => {
  it('measures in-memory logging throughput (10,000 log events)', () => {
    let capturedCount = 0;
    const logger = new ObservabilityLogger({
      sink: () => {
        capturedCount++;
      },
    });

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      logger.info({
        component: 'benchmark',
        operation: 'op',
        message: 'High throughput log statement',
        details: { index: i },
      });
    }
    const durationMs = performance.now() - start;

    expect(capturedCount).toBe(10000);
    // Verified throughput
    const logsPerMs = 10000 / durationMs;
    console.log(`[PERF] Logging Throughput: ${Math.round(logsPerMs * 1000)} ops/sec (${durationMs.toFixed(2)}ms for 10k logs)`);
    expect(durationMs).toBeLessThan(2000); // Must be fast
  });

  it('measures metrics increment and histogram recording overhead (50,000 ops)', () => {
    const registry = new MetricsRegistry({ maxCardinalityPerMetric: 50 });
    const counter = registry.counter('benchmark_counter');
    const histo = registry.histogram('benchmark_histo');

    const start = performance.now();
    for (let i = 0; i < 25000; i++) {
      counter.increment(1, { op: 'read', status: '200' });
      histo.record(i % 50, { op: 'read' });
    }
    const durationMs = performance.now() - start;

    console.log(`[PERF] Metrics Overhead: ${durationMs.toFixed(2)}ms for 50k operations`);
    expect(durationMs).toBeLessThan(1000);
  });

  it('measures span lifecycle overhead (5,000 spans)', async () => {
    const tracer = new Tracer();

    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      const span = tracer.startSpan('benchmark_span');
      span.setAttribute('tag', 'val');
      span.end();
    }
    const durationMs = performance.now() - start;

    console.log(`[PERF] Tracing Overhead: ${durationMs.toFixed(2)}ms for 5k spans`);
    expect(durationMs).toBeLessThan(1500);
  });

  it('verifies memory boundedness under telemetry buffer pressure', () => {
    const logger = new ObservabilityLogger({ maxBufferSize: 200, sink: () => {} });
    for (let i = 0; i < 5000; i++) {
      logger.info({
        component: 'mem-test',
        operation: 'op',
        message: `Message #${i}`,
      });
    }

    expect(logger.getBufferedEvents().length).toBeLessThanOrEqual(200);
  });

  it('measures health check aggregation latency', async () => {
    const health = new HealthManager();
    for (let i = 0; i < 10; i++) {
      health.registerCheck({
        name: `component-${i}`,
        category: 'DEPENDENCY',
        required: true,
        check: async () => ({ status: 'HEALTHY' }),
      });
    }

    const start = performance.now();
    const report = await health.getHealth();
    const durationMs = performance.now() - start;

    console.log(`[PERF] Health aggregation duration: ${durationMs.toFixed(2)}ms for 10 checks`);
    expect(report.status).toBe('HEALTHY');
    expect(durationMs).toBeLessThan(100);
  });
});
