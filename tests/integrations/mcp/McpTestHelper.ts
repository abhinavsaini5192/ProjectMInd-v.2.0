import { createToolPipeline } from '../../../src/agent/protocol/di/ToolDISetup.js';
import { AgentSessionManager } from '../../../src/agent/runtime/AgentSessionManager.js';
import { AgentRegistry } from '../../../src/agent/runtime/AgentRegistry.js';
import { McpToolAdapter } from '../../../src/integrations/mcp/adapters/McpToolAdapter.js';
import { McpSessionManager } from '../../../src/integrations/mcp/adapters/McpSessionManager.js';
import { ProjectMindMcpServer } from '../../../src/integrations/mcp/server/ProjectMindMcpServer.js';
import { InMemoryMcpTransport } from '../../../src/integrations/mcp/transport/InMemoryMcpTransport.js';
import { createMockToolDependencies } from '../../agent/protocol/ToolTestHelper.js';
import type { McpSessionContext } from '../../../src/integrations/mcp/protocol/McpTypes.js';

export async function createMockMcpHarness(overrides?: {
  workspaceId?: string | undefined;
  repositoryId?: string | undefined;
  maxPayloadBytes?: number | undefined;
}) {
  const workspaceId = overrides?.workspaceId ?? 'test-workspace';
  const repositoryId = overrides?.repositoryId ?? 'test-repo';

  const agentRegistry = new AgentRegistry();
  const sessionManager = new AgentSessionManager();
  const pipeline = createToolPipeline(
    createMockToolDependencies({
      sessionManager,
    })
  );

  const mcpSessionManager = new McpSessionManager({
    sessionManager,
    agentRegistry,
  });

  const defaultSessionContext = await mcpSessionManager.initializeSession({
    workspaceId,
    repositoryId,
    clientInfo: { name: 'test-mcp-agent', version: '1.0.0' },
  });

  const toolAdapter = new McpToolAdapter({
    pipeline,
    sessionManager: mcpSessionManager,
    maxPayloadBytes: overrides?.maxPayloadBytes,
  });

  const server = new ProjectMindMcpServer({
    workspaceId,
    repositoryId,
    toolAdapter,
    sessionManager: mcpSessionManager,
  });

  return {
    workspaceId,
    repositoryId,
    agentRegistry,
    sessionManager,
    pipeline,
    mcpSessionManager,
    toolAdapter,
    server,
    defaultSessionContext,
  };
}
