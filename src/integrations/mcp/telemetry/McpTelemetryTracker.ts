export interface McpToolMetric {
  count: number;
  success: number;
  failures: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

export interface McpTelemetrySnapshot {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  uptimeSeconds: number;
  tools: Record<string, McpToolMetric>;
  errorsByCode: Record<string, number>;
}

export class McpTelemetryTracker {
  private readonly startedAt: number = Date.now();
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private readonly toolMetrics = new Map<string, McpToolMetric>();
  private readonly errorsByCode = new Map<string, number>();

  /**
   * Records execution outcome and latency for an MCP tool call.
   */
  public recordToolExecution(
    toolName: string,
    durationMs: number,
    success: boolean,
    errorCode?: string | undefined
  ): void {
    this.totalRequests++;

    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
      if (errorCode) {
        const currentCount = this.errorsByCode.get(errorCode) ?? 0;
        this.errorsByCode.set(errorCode, currentCount + 1);
      }
    }

    let metric = this.toolMetrics.get(toolName);
    if (!metric) {
      metric = {
        count: 0,
        success: 0,
        failures: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
      };
      this.toolMetrics.set(toolName, metric);
    }

    metric.count++;
    if (success) {
      metric.success++;
    } else {
      metric.failures++;
    }
    metric.totalDurationMs += durationMs;
    metric.avgDurationMs = Math.round((metric.totalDurationMs / metric.count) * 100) / 100;
  }

  /**
   * Generates a telemetry snapshot.
   */
  public getSnapshot(): McpTelemetrySnapshot {
    const tools: Record<string, McpToolMetric> = {};
    for (const [k, v] of this.toolMetrics.entries()) {
      tools[k] = { ...v };
    }

    const errors: Record<string, number> = {};
    for (const [k, v] of this.errorsByCode.entries()) {
      errors[k] = v;
    }

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      tools,
      errorsByCode: errors,
    };
  }

  /**
   * Resets all counters.
   */
  public reset(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.toolMetrics.clear();
    this.errorsByCode.clear();
  }
}
