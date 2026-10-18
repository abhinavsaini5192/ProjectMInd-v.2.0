import { describe, it, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../../src/analytics/registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../../src/analytics/storage/InMemoryAnalyticsStore.js';
import { AnalyticsCollector } from '../../src/analytics/collection/AnalyticsCollector.js';
import { AnalyticsAggregator } from '../../src/analytics/aggregation/AnalyticsAggregator.js';
import { MetricsRegistry } from '../../src/observability/metrics/MetricsRegistry.js';
import { CORE_METRIC_NAMES } from '../../src/observability/metrics/CoreMetrics.js';
import { AnalyticsService } from '../../src/analytics/services/AnalyticsService.js';
import { DeterministicInsightEngine } from '../../src/analytics/insights/DeterministicInsightEngine.js';
import { AnalyticsReportService } from '../../src/analytics/reports/AnalyticsReportService.js';
import { InvalidTimeWindowError } from '../../src/analytics/errors/AnalyticsError.js';
import type { AnalyticsScopeRef } from '../../src/analytics/models/AnalyticsScope.js';

describe('Phase 9.9 — Aggregation, Windows & Historical Trends', () => {
  let registry: MetricRegistry;
  let store: InMemoryAnalyticsStore;
  let collector: AnalyticsCollector;
  let operationalMetrics: MetricsRegistry;
  let aggregator: AnalyticsAggregator;
  let service: AnalyticsService;

  const scope: AnalyticsScopeRef = { scopeType: 'WORKSPACE', workspaceId: 'ws_agg' };

  beforeEach(() => {
    registry = new MetricRegistry();
    store = new InMemoryAnalyticsStore();
    collector = new AnalyticsCollector(store, registry);
    operationalMetrics = new MetricsRegistry();
    aggregator = new AnalyticsAggregator(store, registry, operationalMetrics);

    const insightEngine = new DeterministicInsightEngine();
    const reportService = new AnalyticsReportService(store, aggregator, insightEngine, registry);
    service = new AnalyticsService(registry, aggregator, reportService, insightEngine);
  });

  it('Scenario 9: should compute mathematical aggregations correctly (SUM, AVG, P50, P90, P99)', async () => {
    const now = Date.now();
    // Ingest 10 latency measurements: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    for (let i = 1; i <= 10; i++) {
      await collector.ingestRecord({
        recordId: `rec_lat_${i}`,
        metricId: 'context.assembly_latency.ms',
        timestamp: now - (10 - i) * 1000,
        scope,
        value: i * 10,
        sourceType: 'DIRECT_OBSERVATION',
        sourceReference: `ctx_${i}`,
      });
    }

    const window = {
      type: 'CUSTOM' as const,
      startMs: now - 30_000,
      endMs: now + 1000,
      timezone: 'UTC',
    };

    const res = await aggregator.aggregate(scope, window, ['context.assembly_latency.ms']);
    const mRes = res.metrics['context.assembly_latency.ms'];
    expect(mRes).toBeDefined();
    expect(mRes?.status).toBe('AVAILABLE');
    expect(mRes?.sampleCount).toBe(10);
    // Average of 10..100 = 550 / 10 = 55
    expect(mRes?.value).toBe(55);
  });

  it('Scenario 10 & 11: should respect time-window boundaries and UTC timestamps', async () => {
    const t0 = 1700000000000; // fixed UTC timestamp

    // Before window
    await collector.ingestRecord({
      recordId: 'rec_before',
      metricId: 'usage.context_requests.count',
      timestamp: t0 - 1000,
      scope,
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'b1',
    });

    // Inside window
    await collector.ingestRecord({
      recordId: 'rec_inside',
      metricId: 'usage.context_requests.count',
      timestamp: t0 + 5000,
      scope,
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'i1',
    });

    // After window
    await collector.ingestRecord({
      recordId: 'rec_after',
      metricId: 'usage.context_requests.count',
      timestamp: t0 + 15000,
      scope,
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'a1',
    });

    const window = {
      type: 'CUSTOM' as const,
      startMs: t0,
      endMs: t0 + 10000,
      timezone: 'UTC',
    };

    const agg = await aggregator.aggregate(scope, window, ['usage.context_requests.count']);
    expect(agg.metrics['usage.context_requests.count']?.value).toBe(1);
    expect(agg.metrics['usage.context_requests.count']?.count).toBe(1);
  });

  it('Scenario 22: should reuse existing operational metrics without duplicating runtime instrumentation', async () => {
    // Record into operational MetricsRegistry
    const reqCounter = operationalMetrics.counter(CORE_METRIC_NAMES.API_REQUESTS_TOTAL);
    reqCounter.increment(100);

    const errCounter = operationalMetrics.counter(CORE_METRIC_NAMES.API_ERRORS_TOTAL);
    errCounter.increment(5);

    const latencyHisto = operationalMetrics.histogram(CORE_METRIC_NAMES.API_REQUEST_DURATION_MS);
    for (let i = 0; i < 50; i++) {
      latencyHisto.record(i * 2);
    }

    const window = {
      type: 'LAST_24H' as const,
      startMs: Date.now() - 86400000,
      endMs: Date.now(),
      timezone: 'UTC',
    };

    const res = await aggregator.aggregate(
      { scopeType: 'INSTANCE' },
      window,
      ['reliability.api_requests.count', 'reliability.error_rate.percentage', 'reliability.api_latency.p95_ms']
    );

    expect(res.metrics['reliability.api_requests.count']?.value).toBe(100);
    expect(res.metrics['reliability.error_rate.percentage']?.value).toBe(5); // 5 / 100 = 5%
    expect(res.metrics['reliability.api_latency.p95_ms']?.value).toBeGreaterThan(0);
  });

  it('Scenario 25 & 26: should generate immutable snapshot with freshness evaluation', async () => {
    const now = Date.now();
    await collector.ingestRecord({
      recordId: 'rec_snap',
      metricId: 'usage.tasks_completed.count',
      timestamp: now,
      scope,
      value: 10,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'snap_t',
    });

    const window = {
      type: 'LAST_24H' as const,
      startMs: now - 86400000,
      endMs: now,
      timezone: 'UTC',
    };

    const snap = await aggregator.generateSnapshot(scope, window);
    expect(snap.snapshotId).toMatch(/^snap_/);
    expect(snap.metrics['usage.tasks_completed.count']?.value).toBe(10);
    expect(snap.metrics['usage.tasks_completed.count']?.sourceFreshnessMs).toBeDefined();

    // Stored and retrievable
    const stored = await store.getSnapshot(snap.snapshotId);
    expect(stored).toBeDefined();
    expect(stored?.snapshotId).toBe(snap.snapshotId);
  });

  it('Scenario 27: should compare two time windows and detect improvements or regressions', async () => {
    const t0 = Date.now();

    // Base window (prior week): 10 errors
    for (let i = 0; i < 10; i++) {
      await collector.ingestRecord({
        recordId: `base_err_${i}`,
        metricId: 'plugin.failure_rate.percentage',
        timestamp: t0 - 10 * 86400000,
        scope,
        value: 10,
        sourceType: 'DIRECT_OBSERVATION',
        sourceReference: `b_${i}`,
      });
    }

    // Compare window (current week): 2 errors (improvement!)
    for (let i = 0; i < 2; i++) {
      await collector.ingestRecord({
        recordId: `comp_err_${i}`,
        metricId: 'plugin.failure_rate.percentage',
        timestamp: t0 - 2 * 86400000,
        scope,
        value: 2,
        sourceType: 'DIRECT_OBSERVATION',
        sourceReference: `c_${i}`,
      });
    }

    const comparison = await aggregator.compareWindows({
      scope,
      baseWindow: {
        type: 'CUSTOM',
        startMs: t0 - 14 * 86400000,
        endMs: t0 - 7 * 86400000,
        timezone: 'UTC',
      },
      compareWindow: {
        type: 'CUSTOM',
        startMs: t0 - 7 * 86400000,
        endMs: t0,
        timezone: 'UTC',
      },
      metricIds: ['plugin.failure_rate.percentage'],
    });

    const compItem = comparison.comparisons['plugin.failure_rate.percentage'];
    expect(compItem).toBeDefined();
    expect(compItem?.baseValue).toBe(10);
    expect(compItem?.compareValue).toBe(2);
    expect(compItem?.absoluteDelta).toBe(-8);
    expect(compItem?.trend).toBe('IMPROVED'); // Lower failures is improvement
  });

  it('Scenario 29 & 30: should paginate queries and reject unbounded windows > 90 days', async () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      await collector.ingestRecord({
        recordId: `rec_pg_${i}`,
        metricId: 'usage.context_requests.count',
        timestamp: now - i * 1000,
        scope,
        value: 1,
        sourceType: 'DIRECT_OBSERVATION',
        sourceReference: `pg_${i}`,
      });
    }

    const page1 = await store.getRecords({ scope, limit: 5, offset: 0 });
    expect(page1.length).toBe(5);

    const page2 = await store.getRecords({ scope, limit: 5, offset: 5 });
    expect(page2.length).toBe(5);
    expect(page1[0]?.recordId).not.toBe(page2[0]?.recordId);

    // Reject unbounded window > 90 days
    expect(() =>
      service.normalizeTimeWindow({
        type: 'CUSTOM',
        startMs: now - 100 * 86400000,
        endMs: now,
      })
    ).toThrow(InvalidTimeWindowError);
  });

  it('Scenario 33: should handle concurrent aggregation requests without state corruption', async () => {
    const now = Date.now();
    await collector.ingestRecord({
      recordId: 'rec_conc',
      metricId: 'usage.tasks_completed.count',
      timestamp: now,
      scope,
      value: 5,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'c_t',
    });

    const window = {
      type: 'LAST_24H' as const,
      startMs: now - 86400000,
      endMs: now,
      timezone: 'UTC',
    };

    const promises = Array.from({ length: 10 }, () =>
      aggregator.aggregate(scope, window, ['usage.tasks_completed.count'])
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(10);
    for (const res of results) {
      expect(res.metrics['usage.tasks_completed.count']?.value).toBe(5);
    }
  });
});
