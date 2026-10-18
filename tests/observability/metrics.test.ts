import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsRegistry } from '../../src/observability/index.js';

describe('Observability - Metrics Subsystem', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry({
      maxCardinalityPerMetric: 5,
      maxHistogramSamples: 100,
    });
  });

  it('increments and tracks counter values', () => {
    const counter = registry.counter('test_requests_total', 'Test total requests');
    counter.increment(1, { status: '200', method: 'GET' });
    counter.increment(2, { status: '200', method: 'GET' });
    counter.increment(1, { status: '500', method: 'POST' });

    expect(counter.getValue({ status: '200', method: 'GET' })).toBe(3);
    expect(counter.getValue({ status: '500', method: 'POST' })).toBe(1);
    expect(counter.getValue({ status: '404', method: 'GET' })).toBe(0);
  });

  it('sets and retrieves gauge values', () => {
    const gauge = registry.gauge('active_connections', 'Current active connections');
    gauge.set(10, { pool: 'read' });
    expect(gauge.getValue({ pool: 'read' })).toBe(10);

    gauge.set(5, { pool: 'read' });
    expect(gauge.getValue({ pool: 'read' })).toBe(5);
  });

  it('records histogram values and computes percentiles and statistics', () => {
    const histo = registry.histogram('request_latency_ms', 'Request latency in ms');
    // Feed 100 values from 1 to 100
    for (let i = 1; i <= 100; i++) {
      histo.record(i, { route: '/api/v1/context' });
    }

    const stats = histo.getStats({ route: '/api/v1/context' });
    expect(stats.count).toBe(100);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(100);
    expect(stats.avg).toBe(50.5);
    expect(stats.p50).toBe(51);
    expect(stats.p90).toBe(91);
    expect(stats.p95).toBe(96);
    expect(stats.p99).toBe(100);
  });

  it('enforces cardinality bounds and routes overflow into fallback bucket', () => {
    const counter = registry.counter('bounded_counter');

    // Register 5 distinct labels (the maximum allowed)
    for (let i = 0; i < 5; i++) {
      counter.increment(1, { id: `id-${i}` });
    }

    // Now add a 6th distinct label (exceeding limit)
    counter.increment(10, { id: 'id-overflow-1' });
    counter.increment(5, { id: 'id-overflow-2' });

    // The overflow bucket should capture the excess
    expect(counter.getValue({ __overflow__: 'true' })).toBe(15);
  });

  it('scrubs forbidden high-cardinality label keys such as passwords and prompts', () => {
    const counter = registry.counter('safe_counter');
    counter.increment(1, {
      operation: 'query',
      password: 'mypassword',
      prompt: 'generate code for me',
      file_path: '/home/user/code.ts',
    });

    const snapshot = registry.getSnapshot();
    const series = snapshot.counters['safe_counter']!.series;
    expect(series).toHaveLength(1);
    const labels = series[0]!.labels;

    expect(labels.operation).toBe('query');
    expect(labels.password).toBeUndefined();
    expect(labels.prompt).toBeUndefined();
    expect(labels.file_path).toBeUndefined();
  });

  it('provides a complete JSON-serializable snapshot of all metrics', () => {
    registry.counter('c1').increment(5);
    registry.gauge('g1').set(42);
    registry.histogram('h1').record(100);

    const snapshot = registry.getSnapshot();
    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.counters['c1']?.series[0]?.value).toBe(5);
    expect(snapshot.gauges['g1']?.series[0]?.value).toBe(42);
    expect(snapshot.histograms['h1']?.series[0]?.value.count).toBe(1);
  });
});
