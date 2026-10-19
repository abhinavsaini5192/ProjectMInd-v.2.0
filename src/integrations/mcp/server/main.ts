#!/usr/bin/env node
import process from 'node:process';
import { ProjectMindMcpServer } from './ProjectMindMcpServer.js';
import { StdioMcpTransport } from '../transport/StdioMcpTransport.js';
import { McpToolAdapter } from '../adapters/McpToolAdapter.js';
import { ProjectMindRepositoryToolAdapter } from '../adapters/ProjectMindRepositoryToolAdapter.js';
import { AgentToolPipeline } from '../../../agent/protocol/pipeline/AgentToolPipeline.js';
import { AgentToolRegistry } from '../../../agent/protocol/registry/AgentToolRegistry.js';
import { AgentSessionManager } from '../../../agent/runtime/AgentSessionManager.js';
import { AgentRegistry } from '../../../agent/runtime/AgentRegistry.js';
import { McpSessionManager } from '../adapters/McpSessionManager.js';

// Ensure stdout is reserved exclusively for MCP stdio JSON-RPC transport
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
console.log = (...args: unknown[]) => {
  process.stderr.write(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n');
};
console.info = (...args: unknown[]) => {
  process.stderr.write(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n');
};

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

  const canonicalToolAdapter = new McpToolAdapter({
    pipeline: toolPipeline,
    registry: toolRegistry,
    sessionManager: mcpSessionManager,
  });

  const toolAdapter = new ProjectMindRepositoryToolAdapter({
    fallbackAdapter: canonicalToolAdapter,
  });

  const server = new ProjectMindMcpServer({
    name: 'projectmind',
    version: '1.0.0',
    workspaceId,
    repositoryId,
    toolAdapter,
    sessionManager: mcpSessionManager,
  });

  const transport = new StdioMcpTransport();
  await server.start(transport);

  let isStopping = false;
  const shutdown = async () => {
    if (isStopping) return;
    isStopping = true;
    try {
      await server.stop();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('close', () => {
    shutdown().catch(() => {});
  });

  return server;
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('main.js') || process.argv[1]?.endsWith('main.ts')) {
  bootstrapMcpServer().catch((err) => {
    console.error('Failed to start ProjectMind MCP server:', err);
    process.exit(1);
  });
}
