import type { IAnalyticsInsightEngine } from '../interfaces/IAnalyticsInsightEngine.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow, MetricAggregateResult } from '../models/AnalyticsSnapshot.js';
import type { AnalyticsInsight } from '../models/AnalyticsInsight.js';

export class DeterministicInsightEngine implements IAnalyticsInsightEngine {
  public generateInsights(
    scope: AnalyticsScopeRef,
    window: TimeWindow,
    metrics: Record<string, MetricAggregateResult>
  ): readonly AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const now = Date.now();

    // 1. Task Completion Rate Insight
    const taskCompletion = metrics['agent.task_completion_rate.percentage'];
    if (
      taskCompletion &&
      taskCompletion.status === 'AVAILABLE' &&
      taskCompletion.value !== null &&
      taskCompletion.sampleCount > 0 &&
      taskCompletion.value < 80
    ) {
      insights.push({
        insightId: `ins_task_completion_${now}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'Elevated Task Failure Rate Detected',
        category: 'AGENT_COLLABORATION',
        severity: taskCompletion.value < 50 ? 'CRITICAL' : 'WARNING',
        pattern: `Observed task completion rate is ${taskCompletion.value}%, which is below the target threshold of 80%`,
        baseline: 'Expected >= 80% task completion',
        timeWindow: window,
        scope,
        evidenceReferences: [
          {
            metricId: 'agent.task_completion_rate.percentage',
            observedValue: taskCompletion.value,
            expectedOrThreshold: 80,
          },
        ],
        confidence: 0.95,
        recommendation:
          'Inspect failed task execution outputs and agent error logs in TaskRuntime to resolve recurring failure modes.',
        generatedAt: now,
      });
    }

    // 2. Blocked Task Duration Bottleneck
    const blockedDuration = metrics['planning.blocked_task_duration.ms'];
    if (
      blockedDuration &&
      blockedDuration.status === 'AVAILABLE' &&
      blockedDuration.value !== null &&
      blockedDuration.value > 60000
    ) {
      insights.push({
        insightId: `ins_blocked_tasks_${now}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'Task Dependency Bottleneck',
        category: 'PLANNING_AND_EXECUTION',
        severity: 'WARNING',
        pattern: `Tasks spent a cumulative ${Math.round(blockedDuration.value / 1000)}s blocked awaiting dependency fulfillment`,
        baseline: 'Expected < 60s blocked time',
        timeWindow: window,
        scope,
        evidenceReferences: [
          {
            metricId: 'planning.blocked_task_duration.ms',
            observedValue: blockedDuration.value,
            expectedOrThreshold: 60000,
          },
        ],
        confidence: 0.9,
        recommendation:
          'Review task dependency graphs to identify unblocked parallel execution paths.',
        generatedAt: now,
      });
    }

    // 3. Verification Pass Rate
    const verifPassRate = metrics['planning.verification_pass_rate.percentage'];
    if (
      verifPassRate &&
      verifPassRate.status === 'AVAILABLE' &&
      verifPassRate.value !== null &&
      verifPassRate.sampleCount > 0 &&
      verifPassRate.value < 90
    ) {
      insights.push({
        insightId: `ins_verification_${now}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'Suboptimal Verification Pass Rate',
        category: 'PLANNING_AND_EXECUTION',
        severity: 'WARNING',
        pattern: `Verification check pass rate is ${verifPassRate.value}%, falling below the 90% quality gate`,
        baseline: 'Expected >= 90% verification pass rate',
        timeWindow: window,
        scope,
        evidenceReferences: [
          {
            metricId: 'planning.verification_pass_rate.percentage',
            observedValue: verifPassRate.value,
            expectedOrThreshold: 90,
          },
        ],
        confidence: 0.92,
        recommendation:
          'Examine failing assertions and test harness logs before deploying task modifications.',
        generatedAt: now,
      });
    }

    // 4. Plugin Health & Errors
    const pluginFailures = metrics['plugin.failure_rate.percentage'];
    const pluginTimeouts = metrics['plugin.timeouts.count'];
    if (
      (pluginFailures &&
        pluginFailures.status === 'AVAILABLE' &&
        pluginFailures.value !== null &&
        pluginFailures.value > 10) ||
      (pluginTimeouts &&
        pluginTimeouts.status === 'AVAILABLE' &&
        pluginTimeouts.value !== null &&
        pluginTimeouts.value > 0)
    ) {
      insights.push({
        insightId: `ins_plugin_health_${now}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'Plugin Reliability Degradation',
        category: 'PLUGIN_INTELLIGENCE',
        severity: 'WARNING',
        pattern: `Plugins experienced ${pluginFailures?.value ?? 0}% failure rate and ${pluginTimeouts?.value ?? 0} timeouts`,
        baseline: 'Expected < 10% failures and 0 timeouts',
        timeWindow: window,
        scope,
        evidenceReferences: [
          {
            metricId: 'plugin.failure_rate.percentage',
            observedValue: pluginFailures?.value ?? 0,
            expectedOrThreshold: 10,
          },
          {
            metricId: 'plugin.timeouts.count',
            observedValue: pluginTimeouts?.value ?? 0,
            expectedOrThreshold: 0,
          },
        ],
        confidence: 0.94,
        recommendation:
          'Audit plugin execution times, review external adapter latency, or disable degraded plugins.',
        generatedAt: now,
      });
    }

    // 5. Security Authorization Denials
    const authDenials = metrics['security.authorization_denials.count'];
    if (
      authDenials &&
      authDenials.status === 'AVAILABLE' &&
      authDenials.value !== null &&
      authDenials.value > 0
    ) {
      insights.push({
        insightId: `ins_sec_denials_${now}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'Security Authorization Denials Detected',
        category: 'SECURITY_AND_GOVERNANCE',
        severity: 'CRITICAL',
        pattern: `Encountered ${authDenials.value} rejected authorization attempts during the time window`,
        baseline: 'Expected 0 authorization denials under normal operations',
        timeWindow: window,
        scope,
        evidenceReferences: [
          {
            metricId: 'security.authorization_denials.count',
            observedValue: authDenials.value,
            expectedOrThreshold: 0,
          },
        ],
        confidence: 1.0,
        recommendation:
          'Audit principal identity and role assignments to ensure appropriate least-privilege scoping.',
        generatedAt: now,
      });
    }

    // 6. Stale Repository Intelligence
    const repoFreshness = metrics['repo.analysis_freshness.seconds'];
    if (
      repoFreshness &&
      repoFreshness.status === 'AVAILABLE' &&
      repoFreshness.value !== null &&
      repoFreshness.value > 604800 // > 7 days
    ) {
      insights.push({
        insightId: `ins_repo_stale_${now}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'Stale Repository Intelligence',
        category: 'REPOSITORY_INTELLIGENCE',
        severity: 'INFO',
        pattern: `Repository analysis is ${Math.round(repoFreshness.value / 86400)} days old`,
        baseline: 'Recommended repository refresh <= 7 days',
        timeWindow: window,
        scope,
        evidenceReferences: [
          {
            metricId: 'repo.analysis_freshness.seconds',
            observedValue: repoFreshness.value,
            expectedOrThreshold: 604800,
          },
        ],
        confidence: 0.88,
        recommendation:
          'Run repository intelligence extraction to refresh knowledge graphs and feature maps.',
        generatedAt: now,
      });
    }

    return insights;
  }
}
