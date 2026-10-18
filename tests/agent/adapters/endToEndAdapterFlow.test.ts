import { describe, it, expect, beforeEach } from 'vitest';
import { AgentAdapterManager } from '../../../src/agent/adapters/core/AgentAdapterManager.js';
import { GenericAgentAdapter } from '../../../src/agent/adapters/generic/GenericAgentAdapter.js';
import { GenericCliAdapter } from '../../../src/agent/adapters/cli/GenericCliAdapter.js';
import { McpAgentAdapter } from '../../../src/agent/adapters/mcp/McpAgentAdapter.js';
import { IdeAgentAdapter } from '../../../src/agent/adapters/ide/IdeAgentAdapter.js';

describe('End-to-End Multi-Adapter Flow Tests', () => {
  let manager: AgentAdapterManager;

  beforeEach(() => {
    manager = new AgentAdapterManager();
  });

  it('registers multiple heterogeneous adapters and resolves correctly', async () => {
    const genericAdapter = new GenericAgentAdapter();
    const cliAdapter = new GenericCliAdapter();
    const mcpAdapter = new McpAgentAdapter();
    const ideAdapter = new IdeAgentAdapter();

    await manager.registerAdapter(genericAdapter);
    await manager.registerAdapter(cliAdapter);
    await manager.registerAdapter(mcpAdapter);
    await manager.registerAdapter(ideAdapter);

    expect(manager.registry.list()).toHaveLength(4);

    // Resolve by Protocol
    const resolvedMcp = manager.resolveAdapter({ protocol: 'MCP' });
    expect(resolvedMcp.id).toBe('mcp_agent_adapter');

    const resolvedCli = manager.resolveAdapter({ protocol: 'CLI' });
    expect(resolvedCli.id).toBe('cli_agent_adapter');

    const resolvedIde = manager.resolveAdapter({ protocol: 'IDE' });
    expect(resolvedIde.id).toBe('ide_agent_adapter');

    // Resolve by ID
    const resolvedDirect = manager.resolveAdapter({ adapterId: 'generic_agent_adapter' });
    expect(resolvedDirect.id).toBe('generic_agent_adapter');
  });

  it('processes incoming request through manager and produces translated AdapterResponse', async () => {
    const cliAdapter = new GenericCliAdapter();
    await manager.registerAdapter(cliAdapter);

    const result = await manager.processRequest(
      { protocol: 'CLI' },
      {
        prompt: 'Check repository dependencies',
        workspaceId: 'ws_e2e',
        repositoryId: 'repo_e2e',
      }
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.adapterId).toBe('cli_agent_adapter');
    const requestData = result.data as any;
    expect(requestData.operation).toBe('GET_CONTEXT');
    expect(requestData.workspaceContext.workspaceId).toBe('ws_e2e');
    expect(requestData.payload.taskText).toBe('Check repository dependencies');
  });

  it('gracefully shuts down all adapters upon shutdownAll', async () => {
    const genericAdapter = new GenericAgentAdapter();
    const mcpAdapter = new McpAgentAdapter();

    await manager.registerAdapter(genericAdapter);
    await manager.registerAdapter(mcpAdapter);

    expect(genericAdapter.status).toBe('READY');
    expect(mcpAdapter.status).toBe('READY');

    await manager.shutdownAll();

    expect(genericAdapter.status).toBe('STOPPED');
    expect(mcpAdapter.status).toBe('STOPPED');
    expect(manager.registry.list()).toHaveLength(0);
  });
});
