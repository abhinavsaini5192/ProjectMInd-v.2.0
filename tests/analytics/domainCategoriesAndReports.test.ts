import { describe, it, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../../src/analytics/registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../../src/analytics/storage/InMemoryAnalyticsStore.js';
import { AnalyticsCollector } from '../../src/analytics/collection/AnalyticsCollector.js';
import { AnalyticsAggregator } from '../../src/analytics/aggregation/AnalyticsAggregator.js';
import { DeterministicInsightEngine } from '../../src/analytics/insights/DeterministicInsightEngine.js';
import { AnalyticsReportService } from '../../src/analytics/reports/AnalyticsReportService.js';
import { AnalyticsService } from '../../src/analytics/services/AnalyticsService.js';
import type { AnalyticsScopeRef } from '../../src/analytics/models/AnalyticsScope.js';

describe('Phase 9.9 — Domain Categories, Reports & Deterministic Insights', () => {
  let registry: MetricRegistry;
  let store: InMemoryAnalyticsStore;
  let collector: AnalyticsCollector;
  let aggregator: AnalyticsAggregator;
  let insightEngine: DeterministicInsightEngine;
  let reportService: AnalyticsReportService;
  let service: AnalyticsService;

  const scope: AnalyticsScopeRef = { scopeType: 'WORKSPACE', workspaceId: 'ws_domain' };

  beforeEach(() => {
    registry = new MetricRegistry();
    store = new InMemoryAnalyticsStore();
    collector = new AnalyticsCollector(store, registry);
    aggregator = new AnalyticsAggregator(store, registry);
    insightEngine = new DeterministicInsightEngine();
    reportService = new AnalyticsReportService(store, aggregator, insightEngine, registry);
    service = new AnalyticsService(registry, aggregator, reportService, insightEngine);
  });

  it('Scenario 16: should generate Context Effectiveness report with package size and latency', async () => {
    const now = Date.now();
    await collector.ingestRecord({
      recordId: 'ctx_req_1',
      metricId: 'context.requests.count',
      timestamp: now,
      scope,
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'r1',
    });
    await collector.ingestRecord({
      recordId: 'ctx_tok_1',
      metricId: 'context.package_size.tokens',
      timestamp: now,
      scope,
      value: 450,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'r1',
    });
    await collector.ingestRecord({
      recordId: 'ctx_lat_1',
      metricId: 'context.assembly_latency.ms',
      timestamp: now,
      scope,
      value: 28,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'r1',
    });

    const report = await service.generateReport(scope, 'CONTEXT_EFFECTIVENESS');
    expect(report.type).toBe('CONTEXT_EFFECTIVENESS');
    expect(report.results['context.requests.count']?.value).toBe(1);
    expect(report.results['context.package_size.tokens']?.value).toBe(450);
    expect(report.results['context.assembly_latency.ms']?.value).toBe(28);
  });

  it('Scenario 17: should track Retrieval and Project Memory metrics', async () => {
    const now = Date.now();
    await collector.ingestRecord({
      recordId: 'ret_1',
      metricId: 'retrieval.requests.count',
      timestamp: now,
      scope,
      value: 15,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'ret_call',
    });
    await collector.ingestRecord({
      recordId: 'ret_mem_1',
      metricId: 'retrieval.memory_frequency.count',
      timestamp: now,
      scope,
      value: 6,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'mem_call',
    });

    const report = await service.generateReport(scope, 'RETRIEVAL_AND_MEMORY');
    expect(report.type).toBe('RETRIEVAL_AND_MEMORY');
    expect(report.results['retrieval.requests.count']?.value).toBe(15);
    expect(report.results['retrieval.memory_frequency.count']?.value).toBe(6);
  });

  it('Scenario 18 & 19: should generate Task and Agent Collaboration report with grounded insights', async () => {
    const now = Date.now();
    // Agent completion rate 40% (degraded, below 80%)
    await collector.ingestRecord({
      recordId: 'agent_comp_1',
      metricId: 'agent.task_completion_rate.percentage',
      timestamp: now,
      scope,
      value: 40,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'task_run_1',
    });
    // Blocked duration 75s (bottleneck)
    await collector.ingestRecord({
      recordId: 'plan_block_1',
      metricId: 'planning.blocked_task_duration.ms',
      timestamp: now,
      scope,
      value: 75_000,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'plan_run_1',
    });

    const report = await service.generateReport(scope, 'AGENT_COLLABORATION');
    expect(report.type).toBe('AGENT_COLLABORATION');
    expect(report.results['agent.task_completion_rate.percentage']?.value).toBe(40);

    // Insight generated
    const compInsight = report.insights.find((i) => i.title.includes('Task Failure Rate'));
    expect(compInsight).toBeDefined();
    expect(compInsight?.severity).toBe('CRITICAL');
    expect(compInsight?.evidenceReferences[0]?.observedValue).toBe(40);
    expect(compInsight?.evidenceReferences[0]?.expectedOrThreshold).toBe(80);
  });

  it('Scenario 20: should track Learning and Feedback Lifecycle metrics', async () => {
    const now = Date.now();
    await collector.ingestRecord({
      recordId: 'fb_rec_1',
      metricId: 'learning.feedback_volume.count',
      timestamp: now,
      scope,
      value: 12,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'fb_user',
    });
    await collector.ingestRecord({
      recordId: 'cand_rec_1',
      metricId: 'learning.candidates_generated.count',
      timestamp: now,
      scope,
      value: 4,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'cand_gen',
    });
    await collector.ingestRecord({
      recordId: 'dep_rec_1',
      metricId: 'learning.deployed_changes.count',
      timestamp: now,
      scope,
      value: 3,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'cand_dep',
    });

    const report = await service.generateReport(scope, 'LEARNING_LIFECYCLE');
    expect(report.type).toBe('LEARNING_LIFECYCLE');
    expect(report.results['learning.feedback_volume.count']?.value).toBe(12);
    expect(report.results['learning.candidates_generated.count']?.value).toBe(4);
    expect(report.results['learning.deployed_changes.count']?.value).toBe(3);
  });

  it('Scenario 21: should track Plugin Health and integration metrics', async () => {
    const now = Date.now();
    await collector.ingestRecord({
      recordId: 'plug_inv_1',
      metricId: 'plugin.invocations.count',
      timestamp: now,
      scope,
      value: 100,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'inv_100',
    });
    await collector.ingestRecord({
      recordId: 'plug_fail_1',
      metricId: 'plugin.failure_rate.percentage',
      timestamp: now,
      scope,
      value: 15, // 15% error rate triggers insight
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'fail_15',
    });

    const report = await service.generateReport(scope, 'PLUGIN_HEALTH');
    expect(report.type).toBe('PLUGIN_HEALTH');
    expect(report.results['plugin.invocations.count']?.value).toBe(100);
    expect(report.results['plugin.failure_rate.percentage']?.value).toBe(15);

    const pluginInsight = report.insights.find((i) => i.category === 'PLUGIN_INTELLIGENCE');
    expect(pluginInsight).toBeDefined();
    expect(pluginInsight?.severity).toBe('WARNING');
  });

  it('Scenario 24: should include data-quality evaluation and warnings in reports', async () => {
    // Generate report in empty workspace
    const report = await service.generateReport(
      { scopeType: 'WORKSPACE', workspaceId: 'ws_vacant' },
      'OVERVIEW'
    );

    expect(report.dataQuality).toBeDefined();
    expect(report.dataQuality.status).toBeDefined();
    expect(report.dataQuality.coverageRatio).toBeLessThanOrEqual(1.0);
  });

  it('Scenario 28: should preserve report reproducibility and allow re-retrieval by ID', async () => {
    const report1 = await service.generateReport(scope, 'OVERVIEW');
    expect(report1.reportId).toBeDefined();

    const retrieved = await service.getReport(report1.reportId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.reportId).toBe(report1.reportId);
    expect(retrieved?.title).toBe(report1.title);
    expect(retrieved?.generatedAt).toBe(report1.generatedAt);
  });
});
