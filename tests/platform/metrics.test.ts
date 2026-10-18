import { describe, it, expect } from 'vitest';
import { PlatformMetricsCollector } from '../../src/platform/observability/PlatformMetricsCollector.js';
import { PlatformTelemetryService } from '../../src/platform/observability/PlatformTelemetryService.js';

describe('Platform Metrics & Telemetry', () => {
  it('records counters, gauges, and timers with latency percentiles', () => {
    const collector = new PlatformMetricsCollector();

    collector.incrementCounter('requests_total', 1, { status: 'success' });
    collector.incrementCounter('requests_total', 2, { status: 'success' });
    collector.setGauge('active_workers', 5);
    collector.recordTimer('request_duration', 10, { op: 'get' });
    collector.recordTimer('request_duration', 30, { op: 'get' });

    const snapshot = collector.getSnapshot();
    expect(snapshot.counters['requests_total{status="success"}']).toBe(3);
    expect(snapshot.gauges['active_workers']).toBe(5);

    const timer = snapshot.timers['request_duration{op="get"}'];
    expect(timer).toBeDefined();
    expect(timer?.count).toBe(2);
    expect(timer?.totalMs).toBe(40);
    expect(timer?.minMs).toBe(10);
    expect(timer?.maxMs).toBe(30);
    expect(timer?.avgMs).toBe(20);
  });

  it('filters out high-cardinality labels (prompt, path, query) to prevent memory leaks', () => {
    const collector = new PlatformMetricsCollector();

    collector.incrementCounter('agent_requests', 1, {
      operation: 'solve',
      userPrompt: 'Fix the bug in src/auth/login.ts with special query',
      filePath: '/var/app/secrets/pass.json',
      queryParam: 'select * from users',
    });

    const snapshot = collector.getSnapshot();
    const metricKeys = Object.keys(snapshot.counters);
    expect(metricKeys.length).toBe(1);

    const key = metricKeys[0]!;
    expect(key).toContain('operation="solve"');
    expect(key).not.toContain('userPrompt');
    expect(key).not.toContain('filePath');
    expect(key).not.toContain('queryParam');
  });

  it('telemetry service tracks operation lifecycles and runtime gauges', () => {
    const telemetry = new PlatformTelemetryService();

    telemetry.recordStartup(150, true);
    telemetry.recordShutdown(80, true);
    telemetry.recordContextRequest(25, true);
    telemetry.recordToolExecution(40, 'projectmind_get_architecture', true);
    telemetry.updateActiveSessions(3);
    telemetry.updateActiveTasks(7);

    const snapshot = telemetry.getMetricsSnapshot();
    expect(snapshot.counters['platform_startups_total{success="true"}']).toBe(1);
    expect(snapshot.counters['platform_shutdowns_total{graceful="true"}']).toBe(1);
    expect(snapshot.counters['context_requests_total{refreshed="true"}']).toBe(1);
    expect(snapshot.counters['tool_executions_total{success="true",tool="projectmind_get_architecture"}']).toBe(1);
    expect(snapshot.gauges['runtime_sessions_active']).toBe(3);
    expect(snapshot.gauges['runtime_tasks_active']).toBe(7);

    const startupTimer = snapshot.timers['platform_startup_duration'];
    expect(startupTimer).toBeDefined();
    expect(startupTimer?.count).toBe(1);
    expect(startupTimer?.avgMs).toBe(150);
  });

  it('supports startTimer helper to measure function execution duration', async () => {
    const telemetry = new PlatformTelemetryService();
    const stopTimer = telemetry.startTimer('custom_async_op', { stage: 'init' });

    // Wait a short duration
    await new Promise((resolve) => setTimeout(resolve, 30));
    const duration = stopTimer();

    expect(duration).toBeGreaterThanOrEqual(25);
    const snapshot = telemetry.getMetricsSnapshot();
    const timer = snapshot.timers['custom_async_op{stage="init"}'];
    expect(timer?.count).toBe(1);
  });
});
