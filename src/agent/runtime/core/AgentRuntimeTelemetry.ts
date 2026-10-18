import type { AgentRuntimeMetrics, LatencyMetric } from '../models/AgentRuntimeMetrics.js';
import type { IAgentRuntimeTelemetry } from '../interfaces/IAgentRuntimeTelemetry.js';

export class AgentRuntimeTelemetry implements IAgentRuntimeTelemetry {
  private activeSessions = 0;
  private activeTasks = 0;
  private completedTasks = 0;
  private failedTasks = 0;
  private pausedTasks = 0;
  private contextRequests = 0;
  private contextRefreshes = 0;
  private toolExecutions = 0;
  private toolFailures = 0;
  private observationsIngested = 0;
  private verificationsProcessed = 0;
  private knowledgeUpdatesTriggered = 0;
  private staleContextDetections = 0;
  private checkpointsCreated = 0;
  private recoveriesAttempted = 0;
  private recoveriesSucceeded = 0;
  private errorsCount = 0;

  private toolDurations: number[] = [];
  private contextDurations: number[] = [];

  public getMetrics(): AgentRuntimeMetrics {
    const emptyLatency: LatencyMetric = { count: 0, totalMs: 0, minMs: 0, maxMs: 0, avgMs: 0 };

    return {
      activeSessions: this.activeSessions,
      activeTasks: this.activeTasks,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      pausedTasks: this.pausedTasks,
      contextRequests: this.contextRequests,
      contextRefreshes: this.contextRefreshes,
      toolExecutions: this.toolExecutions,
      toolFailures: this.toolFailures,
      observationsIngested: this.observationsIngested,
      verificationsProcessed: this.verificationsProcessed,
      knowledgeUpdatesTriggered: this.knowledgeUpdatesTriggered,
      staleContextDetections: this.staleContextDetections,
      checkpointsCreated: this.checkpointsCreated,
      recoveriesAttempted: this.recoveriesAttempted,
      recoveriesSucceeded: this.recoveriesSucceeded,
      errorsCount: this.errorsCount,
      latencies: {
        contextRetrieval: this.calculateLatency(this.contextDurations),
        toolExecution: this.calculateLatency(this.toolDurations),
        observationProcessing: { ...emptyLatency },
        verificationProcessing: { ...emptyLatency },
        knowledgeUpdate: { ...emptyLatency },
        checkpointCreation: { ...emptyLatency },
        recovery: { ...emptyLatency },
      },
    };
  }

  public recordToolExecution(durationMs: number, success: boolean): void {
    this.toolExecutions++;
    if (!success) {
      this.toolFailures++;
    }
    this.toolDurations.push(durationMs);
    if (this.toolDurations.length > 500) {
      this.toolDurations.shift();
    }
  }

  public recordContextRefresh(durationMs: number): void {
    this.contextRefreshes++;
    this.contextDurations.push(durationMs);
    if (this.contextDurations.length > 500) {
      this.contextDurations.shift();
    }
  }

  public recordTaskCompleted(): void {
    this.completedTasks++;
  }

  public recordTaskFailed(): void {
    this.failedTasks++;
  }

  public incrementRejectedRequests(): void {
    this.errorsCount++;
  }

  public updateActiveSessionsGauge(count: number): void {
    this.activeSessions = count;
  }

  public updateActiveTasksGauge(count: number): void {
    this.activeTasks = count;
  }

  public reset(): void {
    this.activeSessions = 0;
    this.activeTasks = 0;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.pausedTasks = 0;
    this.contextRequests = 0;
    this.contextRefreshes = 0;
    this.toolExecutions = 0;
    this.toolFailures = 0;
    this.observationsIngested = 0;
    this.verificationsProcessed = 0;
    this.knowledgeUpdatesTriggered = 0;
    this.staleContextDetections = 0;
    this.checkpointsCreated = 0;
    this.recoveriesAttempted = 0;
    this.recoveriesSucceeded = 0;
    this.errorsCount = 0;
    this.toolDurations = [];
    this.contextDurations = [];
  }

  private calculateLatency(durations: readonly number[]): LatencyMetric {
    if (durations.length === 0) {
      return { count: 0, totalMs: 0, minMs: 0, maxMs: 0, avgMs: 0 };
    }
    const count = durations.length;
    const totalMs = durations.reduce((sum, v) => sum + v, 0);
    const minMs = Math.min(...durations);
    const maxMs = Math.max(...durations);
    const avgMs = Math.round(totalMs / count);

    return { count, totalMs, minMs, maxMs, avgMs };
  }
}
