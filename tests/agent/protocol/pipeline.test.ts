import { describe, it, expect, beforeEach } from 'vitest';
import { createToolPipeline } from '../../../src/agent/protocol/di/ToolDISetup.js';
import type { AgentToolPipeline } from '../../../src/agent/protocol/pipeline/AgentToolPipeline.js';
import {
  createMockToolRequest,
  createMockToolDependencies,
  createMockSession,
  createMockAgent,
} from './ToolTestHelper.js';
import type { AgentTool } from '../../../src/agent/protocol/models/AgentTool.js';
import type { IAgentToolHandler } from '../../../src/agent/protocol/interfaces/IAgentToolHandler.js';
import { AgentCapabilitySet } from '../../../src/agent/models/AgentCapabilitySet.js';

describe('AgentToolPipeline', () => {
  let pipeline: AgentToolPipeline;
  let deps: ReturnType<typeof createMockToolDependencies>;

  beforeEach(() => {
    deps = createMockToolDependencies();
    pipeline = createToolPipeline(deps);
  });

  it('executes a registered tool successfully and returns standard ToolResponse', async () => {
    const request = createMockToolRequest({
      toolName: 'projectmind_get_context',
      arguments: {
        taskId: 'task-auth-01',
      },
    });

    const response = await pipeline.execute(request);

    expect(response.success).toBe(true);
    expect(response.requestId).toBe(request.requestId);
    expect(response.toolName).toBe('projectmind_get_context');
    expect(response.protocolVersion).toBe('1.0');
    expect(response.result).toBeDefined();
    expect(response.metadata.durationMs).toBeGreaterThanOrEqual(0);
    expect(response.metadata.cached).toBe(false);
  });

  it('returns TOOL_NOT_FOUND when requested tool is not in registry', async () => {
    const request = createMockToolRequest({
      toolName: 'projectmind_non_existent_tool',
      arguments: {},
    });

    const response = await pipeline.execute(request);

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe('TOOL_NOT_FOUND');
    expect(response.error?.retryable).toBe(false);
  });

  it('returns TOOL_DISABLED when tool exists but is flagged disabled', async () => {
    const disabledTool: AgentTool = {
      toolId: 'tool-test-disabled',
      name: 'projectmind_disabled_tool',
      description: 'Disabled tool',
      category: 'SYSTEM',
      version: '1.0.0',
      operation: 'GET_CONTEXT',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object' },
      requiredCapabilities: ['CONTEXT_REQUEST'],
      requiredScope: 'NONE',
      safetyLevel: 'READ_ONLY',
      limits: {},
      enabled: false,
      idempotent: true,
      retryable: false,
    };

    pipeline.getRegistry().registerTool(disabledTool);

    const request = createMockToolRequest({
      toolName: 'projectmind_disabled_tool',
      arguments: {},
    });

    const response = await pipeline.execute(request);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('TOOL_DISABLED');
  });

  it('enforces capability requirements and returns TOOL_CAPABILITY_DENIED on missing capability', async () => {
    const request = createMockToolRequest({
      toolName: 'projectmind_get_context',
      arguments: { taskId: 'task-1' },
    });

    // Agent with empty capabilities
    const restrictedAgent = createMockAgent({
      capabilities: new AgentCapabilitySet([]),
    });

    const response = await pipeline.execute(request, undefined, restrictedAgent);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('TOOL_CAPABILITY_DENIED');
  });

  it('enforces session requirement for session-scoped tools', async () => {
    const request = createMockToolRequest({
      toolName: 'projectmind_report_execution',
      sessionId: undefined,
      arguments: {
        taskId: 'task-1',
        status: 'COMPLETED',
        summary: 'Finished work',
      },
    });

    const response = await pipeline.execute(request);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('TOOL_SCOPE_DENIED');
    expect(response.error?.message).toContain('active session');
  });

  it('enforces execution timeout and returns TOOL_TIMEOUT', async () => {
    const slowTool: AgentTool = {
      toolId: 'tool-slow',
      name: 'projectmind_slow_tool',
      description: 'Slow tool for testing timeouts',
      category: 'SYSTEM',
      version: '1.0.0',
      operation: 'GET_CONTEXT',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object' },
      requiredCapabilities: [],
      requiredScope: 'NONE',
      safetyLevel: 'READ_ONLY',
      limits: { maxExecutionTimeMs: 50 },
      enabled: true,
      idempotent: true,
      retryable: true,
    };

    const slowHandler: IAgentToolHandler = {
      toolName: 'projectmind_slow_tool',
      getToolDefinition: () => slowTool,
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { done: true };
      },
    };

    pipeline.getRegistry().registerTool(slowTool);
    pipeline.registerHandler(slowHandler);

    const request = createMockToolRequest({
      toolName: 'projectmind_slow_tool',
      arguments: {},
    });

    const response = await pipeline.execute(request);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('TOOL_TIMEOUT');
  });

  it('redacts sensitive credentials from execution results', async () => {
    const leakTool: AgentTool = {
      toolId: 'tool-leak',
      name: 'projectmind_leak_tool',
      description: 'Tool returning secrets to verify redaction',
      category: 'SYSTEM',
      version: '1.0.0',
      operation: 'GET_CONTEXT',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object' },
      requiredCapabilities: [],
      requiredScope: 'NONE',
      safetyLevel: 'READ_ONLY',
      limits: {},
      enabled: true,
      idempotent: true,
      retryable: true,
    };

    const leakHandler: IAgentToolHandler = {
      toolName: 'projectmind_leak_tool',
      getToolDefinition: () => leakTool,
      execute: async () => ({
        secretKey: 'AKIA1234567890EXAMPL',
        bearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
      }),
    };

    pipeline.getRegistry().registerTool(leakTool);
    pipeline.registerHandler(leakHandler);

    const request = createMockToolRequest({
      toolName: 'projectmind_leak_tool',
      arguments: {},
    });

    const response = await pipeline.execute(request);

    expect(response.success).toBe(true);
    const result = response.result as Record<string, string>;
    expect(result['secretKey']).toBe('[REDACTED_AWS_KEY]');
    expect(result['bearerToken']).toBe('[REDACTED_JWT_TOKEN]');
  });
});
