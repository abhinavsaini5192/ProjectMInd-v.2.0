import { describe, it, expect } from 'vitest';
import { McpServerLifecycle } from '../../../src/integrations/mcp/lifecycle/McpServerLifecycle.js';
import { McpTelemetryTracker } from '../../../src/integrations/mcp/telemetry/McpTelemetryTracker.js';
import { McpHealthService } from '../../../src/integrations/mcp/server/McpHealthService.js';
import { McpErrorCodes } from '../../../src/integrations/mcp/errors/McpErrorCodes.js';
import { createMockMcpHarness } from './McpTestHelper.js';

describe('MCP Server Lifecycle & Telemetry', () => {
  it('transitions state machine correctly through start and stop', async () => {
    const lifecycle = new McpServerLifecycle();
    expect(lifecycle.getState()).toBe('STOPPED');
    expect(lifecycle.isRunning()).toBe(false);

    lifecycle.start();
    expect(lifecycle.getState()).toBe('RUNNING');
    expect(lifecycle.isRunning()).toBe(true);

    await lifecycle.stop(100);
    expect(lifecycle.getState()).toBe('STOPPED');
    expect(lifecycle.isRunning()).toBe(false);
  });

  it('tracks in-flight requests and rejects new requests during drain', async () => {
    const lifecycle = new McpServerLifecycle();
    lifecycle.start();

    // Enter request
    lifecycle.enterRequest();
    expect(lifecycle.getActiveRequests()).toBe(1);

    // Start draining in background
    let drainCompleted = false;
    const drainPromise = lifecycle.drain(500).then(() => {
      drainCompleted = true;
    });

    expect(lifecycle.getState()).toBe('DRAINING');

    // New requests should be rejected
    expect(() => {
      lifecycle.enterRequest();
    }).toThrowError(/draining/);

    try {
      lifecycle.enterRequest();
    } catch (err: any) {
      expect(err.code).toBe(McpErrorCodes.SERVER_DRAINING);
    }

    // Drain should not be done yet while 1 request active
    expect(drainCompleted).toBe(false);

    // Complete the active request
    lifecycle.exitRequest();
    expect(lifecycle.getActiveRequests()).toBe(0);

    // Drain completes
    await drainPromise;
    expect(drainCompleted).toBe(true);
  });

  it('records tool execution metrics in McpTelemetryTracker', () => {
    const telemetry = new McpTelemetryTracker();

    telemetry.recordToolExecution('projectmind_get_context', 50, true);
    telemetry.recordToolExecution('projectmind_get_context', 100, true);
    telemetry.recordToolExecution('projectmind_get_context', 150, false, 'TOOL_TIMEOUT');
    telemetry.recordToolExecution('projectmind_get_feature', 25, true);

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.totalRequests).toBe(4);
    expect(snapshot.successfulRequests).toBe(3);
    expect(snapshot.failedRequests).toBe(1);
    expect(snapshot.errorsByCode['TOOL_TIMEOUT']).toBe(1);

    const contextTool = snapshot.tools['projectmind_get_context'];
    expect(contextTool).toBeDefined();
    expect(contextTool?.count).toBe(3);
    expect(contextTool?.success).toBe(2);
    expect(contextTool?.failures).toBe(1);
    expect(contextTool?.totalDurationMs).toBe(300);
    expect(contextTool?.avgDurationMs).toBe(100);

    // Test reset
    telemetry.reset();
    const freshSnapshot = telemetry.getSnapshot();
    expect(freshSnapshot.totalRequests).toBe(0);
    expect(Object.keys(freshSnapshot.tools)).toHaveLength(0);
  });

  it('McpHealthService reports operational health status correctly', async () => {
    const { toolAdapter } = await createMockMcpHarness();
    const lifecycle = new McpServerLifecycle();
    const telemetry = new McpTelemetryTracker();
    const healthService = new McpHealthService(lifecycle, telemetry, toolAdapter);

    lifecycle.start();
    const health = await healthService.getHealth();

    expect(health.status).toBe('HEALTHY');
    expect(health.state).toBe('RUNNING');
    expect(health.toolCount).toBe(36);
    expect(health.activeRequests).toBe(0);


    // Simulate draining -> DEGRADED
    await lifecycle.drain(50);
    const drainingHealth = await healthService.getHealth();
    expect(drainingHealth.status).toBe('DEGRADED');

    // Simulate failed -> UNHEALTHY
    lifecycle.fail();
    const failedHealth = await healthService.getHealth();
    expect(failedHealth.status).toBe('UNHEALTHY');
  });
});
