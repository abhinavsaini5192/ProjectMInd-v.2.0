import { describe, it, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../../src/analytics/registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../../src/analytics/storage/InMemoryAnalyticsStore.js';
import { AnalyticsCollector } from '../../src/analytics/collection/AnalyticsCollector.js';
import { EventBusAnalyticsBridge } from '../../src/analytics/collection/EventBusAnalyticsBridge.js';
import { AuditAnalyticsBridge } from '../../src/analytics/collection/AuditAnalyticsBridge.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { PersistentAuditStore } from '../../src/storage/repositories/PersistentAuditStore.js';
import type { AnalyticsRecord } from '../../src/analytics/models/AnalyticsRecord.js';
import { MetricNotFoundError } from '../../src/analytics/errors/AnalyticsError.js';
import { AnalyticsAggregator } from '../../src/analytics/aggregation/AnalyticsAggregator.js';

describe('Phase 9.9 — Collection, Ingestion & Retention', () => {
  let eventBus: NodeEventBus;
  let registry: MetricRegistry;
  let store: InMemoryAnalyticsStore;
  let collector: AnalyticsCollector;
  let eventBridge: EventBusAnalyticsBridge;
  let auditStore: PersistentAuditStore;
  let auditBridge: AuditAnalyticsBridge;
  let aggregator: AnalyticsAggregator;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    registry = new MetricRegistry(eventBus, true);
    store = new InMemoryAnalyticsStore();
    collector = new AnalyticsCollector(store, registry, eventBus);
    eventBridge = new EventBusAnalyticsBridge(eventBus, collector);
    eventBridge.attach();

    auditStore = new PersistentAuditStore();
    auditBridge = new AuditAnalyticsBridge(auditStore, collector);
    aggregator = new AnalyticsAggregator(store, registry);
  });

  it('Scenario 4: should collect metrics automatically from EventBus domain events', async () => {
    // 1. Dispatch ContextGenerated
    eventBus.publish('ContextGenerated', {
      requestId: 'req_100',
      workspaceId: 'ws_demo',
      estimatedTokens: 350,
      durationMs: 42,
    });

    // 2. Dispatch TaskCompleted
    eventBus.publish('TaskCompleted', {
      taskId: 'task_200',
      workspaceId: 'ws_demo',
    });

    // 3. Dispatch Plugin.Invoked
    eventBus.publish('Plugin.Invoked', {
      invocationId: 'inv_300',
      pluginId: 'git_plugin',
      workspaceId: 'ws_demo',
    });

    // Let microtasks flush
    await new Promise((r) => setTimeout(r, 10));

    const records = await store.getRecords({
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_demo' },
    });

    expect(records.length).toBeGreaterThanOrEqual(4);
    const tokenRecord = records.find((r) => r.metricId === 'context.package_size.tokens');
    expect(tokenRecord).toBeDefined();
    expect(tokenRecord?.value).toBe(350);

    const taskRecord = records.find((r) => r.metricId === 'usage.tasks_completed.count');
    expect(taskRecord).toBeDefined();
    expect(taskRecord?.value).toBe(1);
  });

  it('Scenario 5: should handle duplicate events idempotently without double counting', async () => {
    const record: AnalyticsRecord = {
      recordId: 'rec_idempotent_123',
      metricId: 'usage.context_requests.count',
      timestamp: Date.now(),
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_test' },
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'ref_1',
    };

    await collector.ingestRecord(record);
    // Duplicate ingestion
    await collector.ingestRecord(record);
    await collector.ingestRecord(record);

    const stored = await store.getRecords({
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_test' },
      metricIds: ['usage.context_requests.count'],
    });

    expect(stored.length).toBe(1);
  });

  it('Scenario 6: should preserve timestamp order and accept late-arriving events', async () => {
    const now = Date.now();
    const pastTime1 = now - 100_000;
    const pastTime2 = now - 50_000;

    // Ingest newer record first
    await collector.ingestRecord({
      recordId: 'rec_newer',
      metricId: 'usage.context_requests.count',
      timestamp: pastTime2,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_time' },
      value: 10,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'ref_newer',
    });

    // Ingest older record later (late arrival)
    await collector.ingestRecord({
      recordId: 'rec_older',
      metricId: 'usage.context_requests.count',
      timestamp: pastTime1,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_time' },
      value: 5,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'ref_older',
    });

    const stored = await store.getRecords({
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_time' },
    });

    expect(stored.length).toBe(2);
    // Returned in chronological order
    expect(stored[0]?.timestamp).toBe(pastTime1);
    expect(stored[1]?.timestamp).toBe(pastTime2);
  });

  it('Scenario 7 & 8: should distinguish real zero from unavailable/missing metrics', async () => {
    const now = Date.now();
    const window = {
      type: 'CUSTOM' as const,
      startMs: now - 3600_000,
      endMs: now,
      timezone: 'UTC',
    };

    // Aggregate with 0 records for usage.context_requests.count (SUM/COUNT method)
    const result = await aggregator.aggregate(
      { scopeType: 'WORKSPACE', workspaceId: 'ws_empty' },
      window,
      ['usage.context_requests.count', 'context.assembly_latency.ms']
    );

    // SUM metric returns real 0 with status AVAILABLE
    const countRes = result.metrics['usage.context_requests.count'];
    expect(countRes).toBeDefined();
    expect(countRes?.value).toBe(0);
    expect(countRes?.status).toBe('AVAILABLE');

    // AVG metric returns null with status UNAVAILABLE (never fabricated as 0!)
    const latencyRes = result.metrics['context.assembly_latency.ms'];
    expect(latencyRes).toBeDefined();
    expect(latencyRes?.value).toBeNull();
    expect(latencyRes?.status).toBe('UNAVAILABLE');
  });

  it('Scenario 31: should reject unregistered metric IDs during collection', async () => {
    await expect(
      collector.ingestRecord({
        recordId: 'rec_unregistered',
        metricId: 'nonexistent.random.metric',
        timestamp: Date.now(),
        scope: { scopeType: 'INSTANCE' },
        value: 1,
        sourceType: 'DIRECT_OBSERVATION',
        sourceReference: 'ref_unknown',
      })
    ).rejects.toThrow(MetricNotFoundError);
  });

  it('Scenario 32: should prune expired records based on retention policy while retaining snapshots', async () => {
    const now = Date.now();
    const oldTimestamp = now - 100 * 86_400_000; // 100 days old

    // Old record
    await collector.ingestRecord({
      recordId: 'rec_old',
      metricId: 'usage.context_requests.count',
      timestamp: oldTimestamp,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_retention' },
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'ref_old',
    });

    // Recent record
    await collector.ingestRecord({
      recordId: 'rec_recent',
      metricId: 'usage.context_requests.count',
      timestamp: now,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_retention' },
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'ref_recent',
    });

    // Snapshot
    await store.saveSnapshot({
      snapshotId: 'snap_retained',
      timestamp: oldTimestamp,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_retention' },
      timeWindow: { type: 'SNAPSHOT', startMs: oldTimestamp, endMs: oldTimestamp, timezone: 'UTC' },
      metrics: {},
      dataQuality: { status: 'HEALTHY', coverageRatio: 1, warnings: [], missingMetrics: [], staleSources: [], evaluatedAt: oldTimestamp },
    });

    // Prune records older than 90 days
    const cutoff = now - 90 * 86_400_000;
    const pruned = await store.pruneRecords(cutoff);
    expect(pruned).toBe(1);

    const remaining = await store.getRecords({
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_retention' },
    });
    expect(remaining.length).toBe(1);
    expect(remaining[0]?.recordId).toBe('rec_recent');

    // Immutable snapshot remains untouched
    const snap = await store.getSnapshot('snap_retained');
    expect(snap).toBeDefined();
  });
});
