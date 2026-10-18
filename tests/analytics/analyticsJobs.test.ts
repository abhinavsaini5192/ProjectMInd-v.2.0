import { describe, it, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../../src/analytics/registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../../src/analytics/storage/InMemoryAnalyticsStore.js';
import { AnalyticsCollector } from '../../src/analytics/collection/AnalyticsCollector.js';
import { AnalyticsAggregator } from '../../src/analytics/aggregation/AnalyticsAggregator.js';
import { DeterministicInsightEngine } from '../../src/analytics/insights/DeterministicInsightEngine.js';
import { AnalyticsReportService } from '../../src/analytics/reports/AnalyticsReportService.js';
import { AnalyticsService } from '../../src/analytics/services/AnalyticsService.js';
import { AnalyticsSnapshotJobHandler } from '../../src/analytics/jobs/AnalyticsSnapshotJobHandler.js';
import { AnalyticsMaintenanceJobHandler } from '../../src/analytics/jobs/AnalyticsMaintenanceJobHandler.js';
import type { Job } from '../../src/jobs/models/Job.js';
import type { JobExecutionContext } from '../../src/jobs/registry/IJobHandler.js';

describe('Phase 9.9 — Background Jobs Integration', () => {
  let store: InMemoryAnalyticsStore;
  let registry: MetricRegistry;
  let service: AnalyticsService;
  let snapshotHandler: AnalyticsSnapshotJobHandler;
  let maintenanceHandler: AnalyticsMaintenanceJobHandler;

  beforeEach(() => {
    store = new InMemoryAnalyticsStore();
    registry = new MetricRegistry();
    const collector = new AnalyticsCollector(store, registry);
    const aggregator = new AnalyticsAggregator(store, registry);
    const insightEngine = new DeterministicInsightEngine();
    const reportService = new AnalyticsReportService(store, aggregator, insightEngine, registry);
    service = new AnalyticsService(registry, aggregator, reportService, insightEngine);

    snapshotHandler = new AnalyticsSnapshotJobHandler(service);
    maintenanceHandler = new AnalyticsMaintenanceJobHandler(store);
  });

  it('Scenario 34: should execute snapshot generation background job with progress reporting', async () => {
    const progressUpdates: number[] = [];
    const mockContext: JobExecutionContext = {
      signal: new AbortController().signal,
      updateProgress: async (current: number) => {
        progressUpdates.push(current);
      },
    } as any;

    const job: Job<any> = {
      jobId: 'job_snap_1',
      type: 'ANALYTICS_SNAPSHOT_GENERATION',
      priority: 'NORMAL',
      status: 'RUNNING',
      payload: {
        scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_job' },
        windowType: 'LAST_24H',
      },
      createdAt: new Date().toISOString(),
      workspaceId: 'ws_job',
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      version: 1,
    };

    const result = await snapshotHandler.execute(job, mockContext);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect((result.output as Record<string, unknown>)?.snapshotId).toBeDefined();
    expect(progressUpdates).toContain(10);
    expect(progressUpdates).toContain(100);
  });

  it('should execute maintenance job to prune expired data', async () => {
    const now = Date.now();
    // Old record 100 days ago
    await store.saveRecord({
      recordId: 'rec_maint_old',
      metricId: 'usage.context_requests.count',
      timestamp: now - 100 * 86400000,
      scope: { scopeType: 'INSTANCE' },
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'm_old',
    });

    const mockContext: JobExecutionContext = {
      signal: new AbortController().signal,
      updateProgress: async () => {},
    } as any;

    const job: Job<any> = {
      jobId: 'job_maint_1',
      type: 'ANALYTICS_MAINTENANCE',
      priority: 'LOW',
      status: 'RUNNING',
      payload: { retentionDays: 90 },
      createdAt: new Date().toISOString(),
      workspaceId: 'ws_job',
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      version: 1,
    };

    const result = await maintenanceHandler.execute(job, mockContext);
    expect(result.metrics?.recordsPruned).toBe(1);
    expect((result.output as Record<string, unknown>)?.prunedCount).toBe(1);
  });
});
