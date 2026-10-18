import { describe, it, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../../src/analytics/registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../../src/analytics/storage/InMemoryAnalyticsStore.js';
import { AnalyticsCollector } from '../../src/analytics/collection/AnalyticsCollector.js';
import { AnalyticsAggregator } from '../../src/analytics/aggregation/AnalyticsAggregator.js';
import { DeterministicInsightEngine } from '../../src/analytics/insights/DeterministicInsightEngine.js';
import { AnalyticsReportService } from '../../src/analytics/reports/AnalyticsReportService.js';
import { AnalyticsService } from '../../src/analytics/services/AnalyticsService.js';
import { AnalyticsScopeUnauthorizedError } from '../../src/analytics/errors/AnalyticsError.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';

describe('Phase 9.9 — Scope Enforcement, Multi-Tenancy & Security', () => {
  let registry: MetricRegistry;
  let store: InMemoryAnalyticsStore;
  let collector: AnalyticsCollector;
  let aggregator: AnalyticsAggregator;
  let service: AnalyticsService;

  beforeEach(() => {
    registry = new MetricRegistry();
    store = new InMemoryAnalyticsStore();
    collector = new AnalyticsCollector(store, registry);
    aggregator = new AnalyticsAggregator(store, registry);
    const insightEngine = new DeterministicInsightEngine();
    const reportService = new AnalyticsReportService(store, aggregator, insightEngine, registry);
    service = new AnalyticsService(registry, aggregator, reportService, insightEngine);
  });

  it('Scenario 12 & 15: should enforce administrative authorization for global instance analytics', async () => {
    const adminPrincipal: SecurityPrincipal = {
      principalId: 'admin_user',
      type: 'USER',
      identityId: 'admin_user',
      status: 'ACTIVE',
      authenticationMethod: 'LOCAL_DEVELOPMENT',
      createdAt: new Date().toISOString(),
      role: 'ADMIN',
    };

    const memberPrincipal: SecurityPrincipal = {
      principalId: 'member_user',
      principalType: 'USER',
      role: 'MEMBER',
      workspaceId: 'ws_alpha',
    } as any;

    // Admin can access INSTANCE analytics
    const adminRes = await service.query(
      { scope: { scopeType: 'INSTANCE' } },
      adminPrincipal
    );
    expect(adminRes).toBeDefined();

    // Member is rejected from INSTANCE analytics
    await expect(
      service.query({ scope: { scopeType: 'INSTANCE' } }, memberPrincipal)
    ).rejects.toThrow(AnalyticsScopeUnauthorizedError);
  });

  it('Scenario 13: should enforce cross-workspace isolation and prevent leakage', async () => {
    const now = Date.now();

    // Data in workspace alpha
    await collector.ingestRecord({
      recordId: 'rec_alpha',
      metricId: 'usage.context_requests.count',
      timestamp: now,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_alpha' },
      value: 10,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'alpha_1',
    });

    // Data in workspace beta
    await collector.ingestRecord({
      recordId: 'rec_beta',
      metricId: 'usage.context_requests.count',
      timestamp: now,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_beta' },
      value: 20,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'beta_1',
    });

    const betaMember: SecurityPrincipal = {
      principalId: 'beta_user',
      principalType: 'USER',
      role: 'MEMBER',
      workspaceId: 'ws_beta',
    } as any;

    // Beta member querying beta workspace succeeds
    const betaRes = await service.query(
      { scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_beta' } },
      betaMember
    );
    expect(betaRes.metrics['usage.context_requests.count']?.value).toBe(20);

    // Beta member attempting to query alpha workspace is blocked
    await expect(
      service.query(
        { scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_alpha' } },
        betaMember
      )
    ).rejects.toThrow(AnalyticsScopeUnauthorizedError);
  });

  it('Scenario 14: should isolate metrics between projects in the same workspace', async () => {
    const now = Date.now();

    await collector.ingestRecord({
      recordId: 'rec_proj_1',
      metricId: 'usage.plans_created.count',
      timestamp: now,
      scope: { scopeType: 'PROJECT', workspaceId: 'ws_shared', projectId: 'proj_backend' },
      value: 5,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'p1',
    });

    await collector.ingestRecord({
      recordId: 'rec_proj_2',
      metricId: 'usage.plans_created.count',
      timestamp: now,
      scope: { scopeType: 'PROJECT', workspaceId: 'ws_shared', projectId: 'proj_frontend' },
      value: 8,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'p2',
    });

    // Query proj_backend only
    const backendRes = await service.query({
      scope: { scopeType: 'PROJECT', workspaceId: 'ws_shared', projectId: 'proj_backend' },
      metricIds: ['usage.plans_created.count'],
    });
    expect(backendRes.metrics['usage.plans_created.count']?.value).toBe(5);

    // Query proj_frontend only
    const frontendRes = await service.query({
      scope: { scopeType: 'PROJECT', workspaceId: 'ws_shared', projectId: 'proj_frontend' },
      metricIds: ['usage.plans_created.count'],
    });
    expect(frontendRes.metrics['usage.plans_created.count']?.value).toBe(8);
  });

  it('Scenario 23: should track security policy violations and authorization denials', async () => {
    const now = Date.now();

    await collector.ingestRecord({
      recordId: 'rec_sec_denial',
      metricId: 'security.authorization_denials.count',
      timestamp: now,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_sec' },
      value: 3,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'sec_1',
    });

    await collector.ingestRecord({
      recordId: 'rec_sec_violation',
      metricId: 'security.policy_violations.count',
      timestamp: now,
      scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_sec' },
      value: 1,
      sourceType: 'DIRECT_OBSERVATION',
      sourceReference: 'sec_2',
    });

    const report = await service.generateReport(
      { scopeType: 'WORKSPACE', workspaceId: 'ws_sec' },
      'GOVERNANCE'
    );

    expect(report.type).toBe('GOVERNANCE');
    expect(report.results['security.authorization_denials.count']?.value).toBe(3);
    expect(report.results['security.policy_violations.count']?.value).toBe(1);

    // Triggered deterministic security insight
    const secInsight = report.insights.find((i) => i.category === 'SECURITY_AND_GOVERNANCE');
    expect(secInsight).toBeDefined();
    expect(secInsight?.severity).toBe('CRITICAL');
  });
});
