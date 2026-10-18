import type { AgentRuntimeMetrics } from '../models/AgentRuntimeMetrics.js';

export interface IAgentRuntimeTelemetry {
  getMetrics(): AgentRuntimeMetrics;
  recordToolExecution(durationMs: number, success: boolean): void;
  recordContextRefresh(durationMs: number): void;
  recordTaskCompleted(): void;
  recordTaskFailed(): void;
  incrementRejectedRequests(): void;
  updateActiveSessionsGauge(count: number): void;
  updateActiveTasksGauge(count: number): void;
  reset(): void;
}
