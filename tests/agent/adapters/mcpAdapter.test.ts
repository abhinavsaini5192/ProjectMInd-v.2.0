import { describe, it, expect, beforeEach } from 'vitest';
import { McpAgentAdapter } from '../../../src/agent/adapters/mcp/McpAgentAdapter.js';
import type { AgentTool } from '../../../src/agent/protocol/models/AgentTool.js';
import type { AgentResponse } from '../../../src/agent/models/AgentResponse.js';

describe('McpAgentAdapter Unit & Integration Tests', () => {
  let adapter: McpAgentAdapter;

  beforeEach(() => {
    adapter = new McpAgentAdapter();
  });

  it('conforms to MCP protocol metadata standards', () => {
    expect(adapter.id).toBe('mcp_agent_adapter');
    expect(adapter.metadata.protocol).toBe('MCP');
    expect(adapter.metadata.protocolVersion).toBe('2024-11-05');
    expect(adapter.metadata.capabilities).toContain('TOOL_CALLING');
    expect(adapter.metadata.capabilities).toContain('MCP');
  });

  it('translates incoming MCP JSON-RPC tools/call request to AdapterRequest', async () => {
    const mcpRpc = {
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/call',
      params: {
        name: 'projectmind_get_context',
        arguments: {
          taskText: 'Refactor database',
          workspaceId: 'ws_mcp',
          repositoryId: 'repo_mcp',
        },
      },
    };

    const req = await adapter.translateRequest(mcpRpc);

    expect(req.requestId).toBe('101');
    expect(req.adapterId).toBe('mcp_agent_adapter');
    expect(req.protocol).toBe('MCP');
    expect(req.workspaceContext.workspaceId).toBe('ws_mcp');
    expect(req.workspaceContext.repositoryId).toBe('repo_mcp');
    expect((req.payload as any).toolName).toBe('projectmind_get_context');
    expect(req.metadata?.mcpMethod).toBe('tools/call');
  });

  it('translates canonical response into MCP CallToolResult with content array', async () => {
    const rawReq = {
      method: 'tools/call',
      params: { name: 'test_tool', arguments: {} },
    };
    const reqEnvelope = await adapter.translateRequest(rawReq);

    const canonicalResponse: AgentResponse = {
      requestId: '101',
      status: 'SUCCESS',
      data: { summary: 'Context prepared successfully' },
      metadata: {
        durationMs: 25,
        timestamp: new Date().toISOString(),
        protocolVersion: '1.0',
      },
    };

    const mcpResponse = await adapter.translateResponse(canonicalResponse, reqEnvelope);

    expect(mcpResponse.status).toBe('SUCCESS');
    const data = mcpResponse.data as any;
    expect(data.isError).toBe(false);
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content[0].type).toBe('text');
    expect(data.content[0].text).toContain('Context prepared successfully');
  });

  it('maps canonical AgentTool to MCP schema format', () => {
    const tool: AgentTool = {
      toolId: 'tool_explain',
      name: 'explain_context',
      description: 'Explain repository context',
      category: 'CONTEXT',
      version: '1.0.0',
      operation: 'EXPLAIN_CONTEXT',
      inputSchema: {
        type: 'object',
        properties: {
          concept: { type: 'string' },
        },
        required: ['concept'],
      },
      outputSchema: { type: 'object' },
      requiredCapabilities: ['CONTEXT_EXPLANATION'],
      requiredScope: 'WORKSPACE_REQUIRED',
      safetyLevel: 'READ_ONLY',
      limits: {},
      enabled: true,
      idempotent: true,
      retryable: true,
    };

    const mcpTool = adapter.mapTool(tool) as any;
    expect(mcpTool.name).toBe('explain_context');
    expect(mcpTool.description).toBe('Explain repository context');
    expect(mcpTool.inputSchema.type).toBe('object');
    expect(mcpTool.inputSchema.properties.concept.type).toBe('string');
  });
});
