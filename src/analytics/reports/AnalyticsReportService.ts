import type { IAnalyticsReportService } from '../interfaces/IAnalyticsReportService.js';
import type { IAnalyticsAggregator } from '../interfaces/IAnalyticsAggregator.js';
import type { IAnalyticsInsightEngine } from '../interfaces/IAnalyticsInsightEngine.js';
import type { IAnalyticsStore } from '../interfaces/IAnalyticsStore.js';
import type { IMetricRegistry } from '../interfaces/IMetricRegistry.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow } from '../models/AnalyticsSnapshot.js';
import type { AnalyticsReport, ReportType } from '../models/AnalyticsReport.js';
import type { AnalyticsMetric } from '../models/AnalyticsMetric.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { ANALYTICS_EVENT_NAMES } from '../events/AnalyticsEvents.js';

export class AnalyticsReportService implements IAnalyticsReportService {
  constructor(
    private readonly store: IAnalyticsStore,
    private readonly aggregator: IAnalyticsAggregator,
    private readonly insightEngine: IAnalyticsInsightEngine,
    private readonly metricRegistry: IMetricRegistry,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async generateReport(
    scope: AnalyticsScopeRef,
    type: ReportType,
    window: TimeWindow
  ): Promise<AnalyticsReport> {
    const metricIds = this.getMetricIdsForReport(type);
    const aggResult = await this.aggregator.aggregate(scope, window, metricIds);

    const insights = this.insightEngine.generateInsights(
      scope,
      window,
      aggResult.metrics
    );

    const definitions: AnalyticsMetric[] = [];
    for (const mId of Object.keys(aggResult.metrics)) {
      const def = this.metricRegistry.getMetric(mId);
      if (def) {
        definitions.push(def);
      }
    }

    const report: AnalyticsReport = {
      reportId: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type,
      title: this.getReportTitle(type, scope),
      scope,
      timeWindow: window,
      generatedAt: Date.now(),
      metricDefinitions: definitions,
      results: aggResult.metrics,
      dataQuality: aggResult.dataQuality,
      insights,
      provenanceReferences: [`store:records_examined:${aggResult.totalRecordsExamined}`],
      metadata: {
        executionDurationMs: aggResult.executionDurationMs,
      },
    };

    await this.store.saveReport(report);

    if (this.eventBus) {
      this.eventBus.publish(ANALYTICS_EVENT_NAMES.REPORT_GENERATED, {
        reportId: report.reportId,
        reportType: report.type,
        scope,
        timeWindow: window,
        generatedAt: report.generatedAt,
      });
    }

    return report;
  }

  public async getReport(reportId: string): Promise<AnalyticsReport | undefined> {
    return this.store.getReport(reportId);
  }

  public async listReports(
    scope: AnalyticsScopeRef,
    limit: number = 50
  ): Promise<readonly AnalyticsReport[]> {
    return this.store.listReports(scope, limit);
  }

  private getReportTitle(type: ReportType, scope: AnalyticsScopeRef): string {
    const scopeLabel = scope.workspaceId ? ` (Workspace: ${scope.workspaceId})` : ' (Global)';
    switch (type) {
      case 'OVERVIEW':
        return `ProjectMind Enterprise Intelligence Overview${scopeLabel}`;
      case 'PLATFORM_USAGE':
        return `Platform Usage & Activity Report${scopeLabel}`;
      case 'REPOSITORY_INTELLIGENCE':
        return `Repository Intelligence & Knowledge Coverage Report${scopeLabel}`;
      case 'CONTEXT_EFFECTIVENESS':
        return `Context Intelligence & Synthesis Effectiveness Report${scopeLabel}`;
      case 'RETRIEVAL_AND_MEMORY':
        return `Semantic Retrieval & Project Memory Report${scopeLabel}`;
      case 'AGENT_COLLABORATION':
        return `Multi-Agent Collaboration & Handoff Report${scopeLabel}`;
      case 'TASK_EXECUTION':
        return `Task Planning & Execution Orchestration Report${scopeLabel}`;
      case 'LEARNING_LIFECYCLE':
        return `Learning Intelligence & Feedback Lifecycle Report${scopeLabel}`;
      case 'PLUGIN_HEALTH':
        return `Plugin, SDK & Integration Ecosystem Health Report${scopeLabel}`;
      case 'RELIABILITY':
        return `Platform Reliability & Operational Health Report${scopeLabel}`;
      case 'GOVERNANCE':
        return `Enterprise Governance, Security & Audit Report${scopeLabel}`;
    }
  }

  private getMetricIdsForReport(type: ReportType): readonly string[] {
    switch (type) {
      case 'OVERVIEW':
        return [
          'usage.active_workspaces.count',
          'usage.context_requests.count',
          'usage.tasks_completed.count',
          'agent.task_completion_rate.percentage',
          'plugin.invocations.count',
          'plugin.failure_rate.percentage',
          'reliability.error_rate.percentage',
          'security.authorization_denials.count',
        ];
      case 'PLATFORM_USAGE':
        return [
          'usage.active_workspaces.count',
          'usage.active_projects.count',
          'usage.context_requests.count',
          'usage.feature_queries.count',
          'usage.plans_created.count',
          'usage.tasks_completed.count',
          'usage.agent_sessions.count',
          'usage.plugin_invocations.count',
        ];
      case 'REPOSITORY_INTELLIGENCE':
        return [
          'repo.repositories_analyzed.count',
          'repo.analysis_freshness.seconds',
          'repo.extraction_success.count',
          'repo.extraction_failure.count',
          'repo.indexed_resources.count',
          'repo.feature_count',
          'repo.stale_knowledge_references.count',
        ];
      case 'CONTEXT_EFFECTIVENESS':
        return [
          'context.requests.count',
          'context.package_size.tokens',
          'context.assembly_latency.ms',
          'context.cache_hit_rate.percentage',
          'context.failure_rate.percentage',
          'context.explicit_feedback.count',
        ];
      case 'RETRIEVAL_AND_MEMORY':
        return [
          'retrieval.requests.count',
          'retrieval.latency.ms',
          'retrieval.memory_frequency.count',
          'retrieval.failure_rate.percentage',
          'retrieval.index_freshness.seconds',
        ];
      case 'AGENT_COLLABORATION':
        return [
          'agent.sessions.count',
          'agent.tasks_assigned.count',
          'agent.handoffs.count',
          'agent.task_completion_rate.percentage',
          'agent.disconnects.count',
          'agent.conflicts.count',
        ];
      case 'TASK_EXECUTION':
        return [
          'planning.plans_created.count',
          'planning.plan_validation_failures.count',
          'planning.blocked_task_duration.ms',
          'planning.plan_revisions.count',
          'planning.replanning_frequency.count',
          'planning.task_completion_latency.ms',
          'planning.verification_pass_rate.percentage',
        ];
      case 'LEARNING_LIFECYCLE':
        return [
          'learning.feedback_volume.count',
          'learning.candidates_generated.count',
          'learning.candidate_acceptance_rate.percentage',
          'learning.deployed_changes.count',
          'learning.rollbacks.count',
        ];
      case 'PLUGIN_HEALTH':
        return [
          'plugin.registered.count',
          'plugin.enabled.count',
          'plugin.invocations.count',
          'plugin.failure_rate.percentage',
          'plugin.compatibility_failures.count',
          'plugin.timeouts.count',
          'plugin.permission_denials.count',
        ];
      case 'RELIABILITY':
        return [
          'reliability.api_requests.count',
          'reliability.error_rate.percentage',
          'reliability.api_latency.p95_ms',
          'reliability.job_failures.count',
        ];
      case 'GOVERNANCE':
        return [
          'security.authorization_denials.count',
          'security.policy_violations.count',
          'security.permission_changes.count',
          'security.audit_coverage.percentage',
          'security.suspicious_plugin_activity.count',
          'security.cross_scope_attempts.count',
        ];
    }
  }
}
