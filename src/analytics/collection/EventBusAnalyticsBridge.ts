import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import type { IAnalyticsCollector } from '../interfaces/IAnalyticsCollector.js';
import type { AnalyticsRecord } from '../models/AnalyticsRecord.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';

export class EventBusAnalyticsBridge {
  private isAttached: boolean = false;
  private readonly handlers: Array<{ event: string; fn: (payload: any) => void }> = [];

  constructor(
    private readonly eventBus: IEventBus,
    private readonly collector: IAnalyticsCollector
  ) {}

  public attach(): void {
    if (this.isAttached) return;

    this.subscribe('ContextGenerated', (e) => this.handleContextGenerated(e));
    this.subscribe('ContextGenerationFailed', (e) => this.handleContextFailed(e));
    this.subscribe('PlanCreated', (e) => this.handlePlanCreated(e));
    this.subscribe('TaskCompleted', (e) => this.handleTaskCompleted(e));
    this.subscribe('TaskFailed', (e) => this.handleTaskFailed(e));
    this.subscribe('AgentSessionStarted', (e) => this.handleAgentSession(e));
    this.subscribe('AgentHandoffCompleted', (e) => this.handleAgentHandoff(e));
    this.subscribe('AgentDisconnected', (e) => this.handleAgentDisconnected(e));
    this.subscribe('Plugin.Invoked', (e) => this.handlePluginInvoked(e));
    this.subscribe('Plugin.Failed', (e) => this.handlePluginFailed(e));
    this.subscribe('Plugin.Timeout', (e) => this.handlePluginTimeout(e));
    this.subscribe('FeedbackSubmitted', (e) => this.handleFeedbackSubmitted(e));
    this.subscribe('CandidateGenerated', (e) => this.handleCandidateGenerated(e));
    this.subscribe('CandidateApproved', (e) => this.handleCandidateApproved(e));
    this.subscribe('CandidateDeployed', (e) => this.handleCandidateDeployed(e));
    this.subscribe('CandidateRolledBack', (e) => this.handleCandidateRolledBack(e));
    this.subscribe('AuthorizationDenied', (e) => this.handleAuthorizationDenied(e));
    this.subscribe('SecurityPolicyViolation', (e) => this.handleSecurityPolicyViolation(e));
    this.subscribe('VerificationRunCompleted', (e) => this.handleVerificationCompleted(e));

    this.isAttached = true;
  }

  public detach(): void {
    if (!this.isAttached) return;
    for (const h of this.handlers) {
      this.eventBus.unsubscribe(h.event, h.fn);
    }
    this.handlers.length = 0;
    this.isAttached = false;
  }

  private subscribe(eventName: string, handler: (payload: any) => Promise<void> | void): void {
    const wrapped = (event: any) => {
      try {
        const payload = event?.payload ?? event;
        Promise.resolve(handler(payload)).catch(() => {
          // Failure in analytics collection must never crash core platform
        });
      } catch {
        // Safe isolation
      }
    };
    this.eventBus.subscribe(eventName, wrapped);
    this.handlers.push({ event: eventName, fn: wrapped });
  }

  private async emit(
    metricId: string,
    value: number,
    scope: AnalyticsScopeRef,
    sourceRef: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const record: AnalyticsRecord = {
      recordId: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      metricId,
      timestamp: Date.now(),
      scope,
      value,
      sourceType: 'EVENT_BUS',
      sourceReference: sourceRef,
      metadata,
    };
    await this.collector.ingestRecord(record);
  }

  private extractScope(payload: any): AnalyticsScopeRef {
    let scopeType: 'INSTANCE' | 'WORKSPACE' | 'PROJECT' | 'REPOSITORY' = 'INSTANCE';
    if (payload?.repositoryId) {
      scopeType = 'REPOSITORY';
    } else if (payload?.projectId) {
      scopeType = 'PROJECT';
    } else if (payload?.workspaceId) {
      scopeType = 'WORKSPACE';
    }

    return {
      scopeType,
      workspaceId: payload?.workspaceId,
      projectId: payload?.projectId,
      repositoryId: payload?.repositoryId,
      entityId: payload?.pluginId ?? payload?.agentId ?? payload?.planId,
    };
  }

  private async handleContextGenerated(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('usage.context_requests.count', 1, scope, payload?.requestId ?? 'ctx_req');
    await this.emit('context.requests.count', 1, scope, payload?.requestId ?? 'ctx_req');
    if (typeof payload?.estimatedTokens === 'number') {
      await this.emit('context.package_size.tokens', payload.estimatedTokens, scope, payload?.requestId ?? 'ctx_req');
    }
    if (typeof payload?.durationMs === 'number') {
      await this.emit('context.assembly_latency.ms', payload.durationMs, scope, payload?.requestId ?? 'ctx_req');
    }
  }

  private async handleContextFailed(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('context.failure_rate.percentage', 100, scope, payload?.requestId ?? 'ctx_fail');
  }

  private async handlePlanCreated(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('usage.plans_created.count', 1, scope, payload?.planId ?? 'plan_new');
    await this.emit('planning.plans_created.count', 1, scope, payload?.planId ?? 'plan_new');
  }

  private async handleTaskCompleted(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('usage.tasks_completed.count', 1, scope, payload?.taskId ?? 'task_done');
    await this.emit('agent.task_completion_rate.percentage', 100, scope, payload?.taskId ?? 'task_done');
  }

  private async handleTaskFailed(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('agent.task_completion_rate.percentage', 0, scope, payload?.taskId ?? 'task_fail');
  }

  private async handleAgentSession(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('usage.agent_sessions.count', 1, scope, payload?.sessionId ?? 'session_new');
    await this.emit('agent.sessions.count', 1, scope, payload?.sessionId ?? 'session_new');
  }

  private async handleAgentHandoff(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('agent.handoffs.count', 1, scope, payload?.handoffId ?? 'handoff');
  }

  private async handleAgentDisconnected(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('agent.disconnects.count', 1, scope, payload?.agentId ?? 'disconnect');
  }

  private async handlePluginInvoked(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('usage.plugin_invocations.count', 1, scope, payload?.invocationId ?? 'plugin_inv');
    await this.emit('plugin.invocations.count', 1, scope, payload?.invocationId ?? 'plugin_inv');
  }

  private async handlePluginFailed(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('plugin.failure_rate.percentage', 100, scope, payload?.invocationId ?? 'plugin_fail');
  }

  private async handlePluginTimeout(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('plugin.timeouts.count', 1, scope, payload?.invocationId ?? 'plugin_timeout');
  }

  private async handleFeedbackSubmitted(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('learning.feedback_volume.count', 1, scope, payload?.feedbackId ?? 'fb');
  }

  private async handleCandidateGenerated(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('learning.candidates_generated.count', 1, scope, payload?.candidateId ?? 'cand');
  }

  private async handleCandidateApproved(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('learning.candidate_acceptance_rate.percentage', 100, scope, payload?.candidateId ?? 'cand_appr');
  }

  private async handleCandidateDeployed(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('learning.deployed_changes.count', 1, scope, payload?.candidateId ?? 'cand_dep');
  }

  private async handleCandidateRolledBack(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('learning.rollbacks.count', 1, scope, payload?.candidateId ?? 'cand_rb');
  }

  private async handleAuthorizationDenied(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('security.authorization_denials.count', 1, scope, payload?.correlationId ?? 'auth_denied');
  }

  private async handleSecurityPolicyViolation(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    await this.emit('security.policy_violations.count', 1, scope, payload?.violationId ?? 'sec_viol');
  }

  private async handleVerificationCompleted(payload: any): Promise<void> {
    const scope = this.extractScope(payload);
    const passRate = payload?.passed === true ? 100 : (payload?.successRatio ? payload.successRatio * 100 : 0);
    await this.emit('planning.verification_pass_rate.percentage', passRate, scope, payload?.runId ?? 'verif');
  }
}
