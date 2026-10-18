import { describe, it, expect, vi } from 'vitest';
import { createTestProductionRuntime } from './ProductionRuntimeTestHelper.js';
import type { ToolRequest } from '../../../../src/agent/protocol/models/ToolRequest.js';

describe('ProductionAgentRuntime - Observation Coordination & Anti-Elevation', () => {
  it('bridges tool execution to observation processor asynchronously', async () => {
    const ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();

    const spy = vi.spyOn(ctx.observationProcessor, 'processRawObservation');

    const request: ToolRequest = {
      requestId: 'req_obs_1',
      toolName: 'projectmind_get_architecture',
      agentId: 'test-agent',
      protocolVersion: '1.0.0',
      arguments: {},
      workspaceId: 'ws_alpha',
      repositoryId: 'repo_alpha',
      timestamp: new Date().toISOString(),
    };

    const response = await ctx.runtime.executeTool(request);
    expect(response.success).toBe(true);

    // Give microtask queue a moment to run async observation logging
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(spy).toHaveBeenCalledTimes(1);
    const callArg = spy.mock.calls[0]![0];
    expect(callArg.source).toBe('SYSTEM');
    expect(callArg.type).toBe('TOOL_EXECUTION');
  });

  it('enforces AGENT_REPORTED evidence level on execution reports', async () => {
    const ctx = createTestProductionRuntime();
    const spy = vi.spyOn(ctx.executionCoordinator, 'reportExecution');

    const coordinator = (ctx.runtime as any).coordinator.observation;
    await coordinator.recordExecutionReport(
      {
        taskId: 'task_1',
        status: 'COMPLETED',
        summary: 'Agent claims all tests pass',
        metadata: {
          claimedStatus: 'VERIFIED',
        },
      },
      {
        workspaceId: 'ws_alpha',
        repositoryId: 'repo_alpha',
        agentSessionId: 'sess_1',
      }
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const passedParams = spy.mock.calls[0]![0];
    expect(passedParams.metadata?.evidenceLevel).toBe('AGENT_REPORTED');
  });
});
