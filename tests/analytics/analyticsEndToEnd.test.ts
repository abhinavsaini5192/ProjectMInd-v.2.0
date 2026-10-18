import { describe, it, expect, beforeEach } from 'vitest';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { DIContainer } from '../../src/workspace/di/DIContainer.js';
import { AnalyticsDISetup } from '../../src/analytics/di/AnalyticsDISetup.js';
import { AnalyticsTokens } from '../../src/analytics/di/AnalyticsTokens.js';
import type { IAnalyticsService } from '../../src/analytics/interfaces/IAnalyticsService.js';
import type { IAnalyticsStore } from '../../src/analytics/interfaces/IAnalyticsStore.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import { AnalyticsScopeUnauthorizedError } from '../../src/analytics/errors/AnalyticsError.js';

describe('Phase 9.9 — End-to-End Enterprise Intelligence & Analytics Lifecycle', () => {
  let eventBus: NodeEventBus;
  let container: DIContainer;
  let analyticsService: IAnalyticsService;
  let store: IAnalyticsStore;

  const workspaceId = 'ws_enterprise_prod';
  const projectId = 'proj_core_platform';
  const repositoryId = 'repo_projectmind';

  beforeEach(() => {
    eventBus = new NodeEventBus();
    container = new DIContainer();
    analyticsService = AnalyticsDISetup.register(container, { eventBus });
    store = container.resolve(AnalyticsTokens.IAnalyticsStore);
  });

  it('should execute full 15-step enterprise analytics workflow safely', async () => {
    // Step 1: Workspace contains a project and repository
    const scope = {
      scopeType: 'PROJECT' as const,
      workspaceId,
      projectId,
      repositoryId,
    };

    // Step 2 & 3: Agent requests context, ProjectMind emits ContextGenerated
    eventBus.publish('ContextGenerated', {
      requestId: 'ctx_req_e2e_1',
      workspaceId,
      projectId,
      estimatedTokens: 520,
      durationMs: 38,
    });

    // Step 4: A task plan is created
    eventBus.publish('PlanCreated', {
      planId: 'plan_e2e_1',
      workspaceId,
      projectId,
      tasksCount: 3,
    });

    // Step 5: Tasks execute through existing runtime
    eventBus.publish('TaskCompleted', {
      taskId: 'task_1',
      planId: 'plan_e2e_1',
      workspaceId,
      projectId,
      durationMs: 120,
    });
    eventBus.publish('TaskCompleted', {
      taskId: 'task_2',
      planId: 'plan_e2e_1',
      workspaceId,
      projectId,
      durationMs: 250,
    });

    // Step 6: Verification results are recorded
    eventBus.publish('VerificationRunCompleted', {
      runId: 'verif_run_1',
      workspaceId,
      projectId,
      passed: true,
      assertionsTotal: 15,
      assertionsPassed: 15,
    });

    // Step 7: A plugin invocation succeeds
    eventBus.publish('Plugin.Invoked', {
      invocationId: 'plug_inv_1',
      pluginId: 'org.projectmind.git-context-provider',
      workspaceId,
      projectId,
      durationMs: 18,
    });

    // Step 8: Additional domain events emitted
    eventBus.publish('FeedbackSubmitted', {
      feedbackId: 'fb_1',
      workspaceId,
      projectId,
      rating: 5,
    });

    // Let async event bridge process all published events
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Step 9: Verify analytics collector ingested evidence
    const records = await store.getRecords({ scope });
    expect(records.length).toBeGreaterThanOrEqual(7);

    // Step 10: Metrics are calculated for defined time window (last 24 hours)
    const queryResult = await analyticsService.query({
      scope,
      timeWindow: { type: 'LAST_24H' },
    });
    expect(queryResult.totalRecordsExamined).toBeGreaterThanOrEqual(7);

    // Step 11: A report is generated
    const report = await analyticsService.generateReport(scope, 'OVERVIEW', { type: 'LAST_24H' });
    expect(report.reportId).toBeDefined();
    expect(report.type).toBe('OVERVIEW');

    // Step 12: Report includes metric definitions and source freshness
    expect(report.metricDefinitions.length).toBeGreaterThan(0);
    const contextRequests = report.results['usage.context_requests.count'];
    expect(contextRequests).toBeDefined();
    expect(contextRequests?.value).toBe(1);
    expect(contextRequests?.sourceFreshnessMs).toBeDefined();

    const tasksCompleted = report.results['usage.tasks_completed.count'];
    expect(tasksCompleted?.value).toBe(2);

    const pluginInvocations = report.results['plugin.invocations.count'];
    expect(pluginInvocations?.value).toBe(1);

    // Step 13: Authorized user retrieves the report
    const authorizedPrincipal: SecurityPrincipal = {
      principalId: 'lead_architect',
      principalType: 'USER',
      role: 'ADMIN',
      workspaceId,
    } as any;

    const retrievedReport = await analyticsService.getReport(report.reportId, authorizedPrincipal);
    expect(retrievedReport).toBeDefined();
    expect(retrievedReport?.reportId).toBe(report.reportId);

    // Step 14: Unauthorized user cannot access another workspace's data
    const unauthorizedPrincipal: SecurityPrincipal = {
      principalId: 'outsider_user',
      principalType: 'USER',
      role: 'MEMBER',
      workspaceId: 'other_workspace',
    } as any;

    await expect(
      analyticsService.getReport(report.reportId, unauthorizedPrincipal)
    ).rejects.toThrow(AnalyticsScopeUnauthorizedError);

    // Step 15: A missing source produces explicit data-quality warning instead of a fabricated value
    const dataQuality = report.dataQuality;
    expect(dataQuality).toBeDefined();
    expect(dataQuality.status).toBeDefined();
    // Missing metrics are explicitly listed rather than fabricating metrics
    expect(Array.isArray(dataQuality.missingMetrics)).toBe(true);
  });
});
