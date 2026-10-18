import { PlatformMetricsCollector, type MetricSnapshot } from './PlatformMetricsCollector.js';

export class PlatformTelemetryService {
  constructor(private readonly collector: PlatformMetricsCollector = new PlatformMetricsCollector()) {}

  public getCollector(): PlatformMetricsCollector {
    return this.collector;
  }

  public startTimer(operationName: string, labels?: Record<string, string>): () => number {
    const startTime = Date.now();
    return () => {
      const durationMs = Date.now() - startTime;
      this.collector.recordTimer(operationName, durationMs, labels);
      return durationMs;
    };
  }

  public recordStartup(durationMs: number, success: boolean): void {
    this.collector.recordTimer('platform_startup_duration', durationMs);
    this.collector.incrementCounter('platform_startups_total', 1, { success: String(success) });
  }

  public recordShutdown(durationMs: number, graceful: boolean): void {
    this.collector.recordTimer('platform_shutdown_duration', durationMs);
    this.collector.incrementCounter('platform_shutdowns_total', 1, { graceful: String(graceful) });
  }

  public recordContextRequest(durationMs: number, wasRefreshed: boolean): void {
    this.collector.recordTimer('context_request_duration', durationMs);
    this.collector.incrementCounter('context_requests_total', 1, { refreshed: String(wasRefreshed) });
  }

  public recordToolExecution(durationMs: number, toolName: string, success: boolean): void {
    this.collector.recordTimer('tool_execution_duration', durationMs, { tool: toolName });
    this.collector.incrementCounter('tool_executions_total', 1, { tool: toolName, success: String(success) });
  }

  public updateActiveSessions(count: number): void {
    this.collector.setGauge('runtime_sessions_active', count);
  }

  public updateActiveTasks(count: number): void {
    this.collector.setGauge('runtime_tasks_active', count);
  }

  public getMetricsSnapshot(): MetricSnapshot {
    return this.collector.getSnapshot();
  }
}
