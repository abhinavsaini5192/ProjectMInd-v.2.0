#!/usr/bin/env node
import process from 'node:process';
import { ProjectMindMcpServer } from './ProjectMindMcpServer.js';
import { StdioMcpTransport } from '../transport/StdioMcpTransport.js';
import { McpToolAdapter } from '../adapters/McpToolAdapter.js';
import { AgentToolPipeline } from '../../../agent/protocol/pipeline/AgentToolPipeline.js';
import { AgentToolRegistry } from '../../../agent/protocol/registry/AgentToolRegistry.js';
import { AgentSessionManager } from '../../../agent/runtime/AgentSessionManager.js';
import { AgentRegistry } from '../../../agent/runtime/AgentRegistry.js';
import { McpSessionManager } from '../adapters/McpSessionManager.js';

export async function bootstrapMcpServer(): Promise<ProjectMindMcpServer> {
  const args = process.argv.slice(2);
  let workspaceId = process.env['PROJECTMIND_WORKSPACE_ID'] ?? process.cwd();
  let repositoryId = process.env['PROJECTMIND_REPOSITORY_ID'] ?? 'default-repo';

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--workspace' || args[i] === '-w') && args[i + 1]) {
      workspaceId = args[i + 1]!;
      i++;
    } else if ((args[i] === '--repo' || args[i] === '-r') && args[i + 1]) {
      repositoryId = args[i + 1]!;
      i++;
    }
  }

  const agentRegistry = new AgentRegistry();
  const sessionManager = new AgentSessionManager();
  const toolRegistry = new AgentToolRegistry();
  const toolPipeline = new AgentToolPipeline({
    registry: toolRegistry,
    sessionManager,
  });

  const mcpSessionManager = new McpSessionManager({
    sessionManager,
    agentRegistry,
  });

  const toolAdapter = new McpToolAdapter({
    pipeline: toolPipeline,
    registry: toolRegistry,
    sessionManager: mcpSessionManager,
  });

  const server = new ProjectMindMcpServer({
    workspaceId,
    repositoryId,
    toolAdapter,
    sessionManager: mcpSessionManager,
  });

  const transport = new StdioMcpTransport();
  await server.start(transport);

  const shutdown = async () => {
    try {
      await server.stop();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('main.js') || process.argv[1]?.endsWith('main.ts')) {
  bootstrapMcpServer().catch((err) => {
    console.error('Failed to start ProjectMind MCP server:', err);
    process.exit(1);
  });
}
