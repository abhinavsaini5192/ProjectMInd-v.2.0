import { describe, it, expect } from 'vitest';
import { AdapterRegistry } from '../../src/agent/adapters/AdapterRegistry.js';
import type { IAgentAdapter } from '../../src/agent/interfaces/IAgentAdapter.js';
import type { AgentRequest } from '../../src/agent/models/AgentRequest.js';
import type { AgentResponse } from '../../src/agent/models/AgentResponse.js';

describe('AdapterRegistry', () => {
  it('registers and retrieves adapters by id and agent type', () => {
    const registry = new AdapterRegistry();

    const mockClaudeAdapter: IAgentAdapter<{ prompt: string }, { reply: string }> = {
      id: 'claude_code_adapter',
      name: 'Claude Code Adapter',
      targetAgentType: 'CLI_AGENT',
      supportedProtocolVersions: ['1.0'],
      adaptRequest: async (input) => ({
        requestId: 'req_claude_1',
        protocolVersion: '1.0',
        operation: 'GET_CONTEXT',
        agentId: 'claude_agent',
        workspaceContext: { workspaceId: 'ws_1', repositoryId: 'repo_1' },
        payload: { taskText: input.prompt },
        timestamp: new Date().toISOString(),
      }),
      adaptResponse: async (response: AgentResponse) => ({
        reply: String((response.data as any)?.content ?? ''),
      }),
    };

    registry.register(mockClaudeAdapter);

    expect(registry.get('claude_code_adapter')).toBe(mockClaudeAdapter);
    expect(registry.getByAgentType('CLI_AGENT')).toContain(mockClaudeAdapter);
    expect(registry.getByAgentType('IDE_AGENT').length).toBe(0);
    expect(registry.list()).toEqual([mockClaudeAdapter]);
  });
});
