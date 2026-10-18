import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime } from './ProductionRuntimeTestHelper.js';
import type { ToolRequest } from '../../../../src/agent/protocol/models/ToolRequest.js';
import { RuntimeCapacityError, RuntimeTimeoutError } from '../../../../src/agent/runtime/errors/AgentRuntimeError.js';

describe('ProductionAgentRuntime - Tool Routing & Execution', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;

  beforeEach(async () => {
    ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();
  });

  const sampleRequest: ToolRequest = {
    requestId: 'req_1',
    toolName: 'projectmind_get_context',
    agentId: 'test-agent',
    protocolVersion: '1.0.0',
    arguments: { query: 'test' },
    workspaceId: 'ws_alpha',
    repositoryId: 'repo_alpha',
    timestamp: new Date().toISOString(),
  };

  it('routes tool execution to pipeline and updates metrics', async () => {
    const response = await ctx.runtime.executeTool(sampleRequest);

    expect(response.requestId).toBe('req_1');
    expect(response.success).toBe(true);

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.toolExecutions).toBe(1);
    expect(metrics.toolFailures).toBe(0);
    expect(metrics.latencies.toolExecution.count).toBe(1);
  });

  it('records tool failures when pipeline returns error', async () => {
    const failCtx = createTestProductionRuntime({ toolSuccess: false });
    await failCtx.runtime.initialize();
    await failCtx.runtime.start();

    const response = await failCtx.runtime.executeTool(sampleRequest);
    expect(response.success).toBe(false);

    const metrics = failCtx.runtime.getMetrics();
    expect(metrics.toolExecutions).toBe(1);
    expect(metrics.toolFailures).toBe(1);
  });

  it('rejects oversized request payloads with RuntimeCapacityError', async () => {
    const smallPayloadCtx = createTestProductionRuntime({
      config: {
        limits: {
          ...({} as any),
          maxRequestSizeBytes: 50,
        },
      },
    });
    await smallPayloadCtx.runtime.initialize();
    await smallPayloadCtx.runtime.start();

    await expect(
      smallPayloadCtx.runtime.executeTool(sampleRequest)
    ).rejects.toThrow(RuntimeCapacityError);
  });

  it('enforces timeout on long-running tool execution with RuntimeTimeoutError', async () => {
    const timeoutCtx = createTestProductionRuntime({
      toolLatencyMs: 150,
      config: {
        limits: {
          ...({} as any),
          toolTimeoutMs: 25,
        },
      },
    });
    await timeoutCtx.runtime.initialize();
    await timeoutCtx.runtime.start();

    await expect(
      timeoutCtx.runtime.executeTool(sampleRequest)
    ).rejects.toThrow(RuntimeTimeoutError);
  });
});
