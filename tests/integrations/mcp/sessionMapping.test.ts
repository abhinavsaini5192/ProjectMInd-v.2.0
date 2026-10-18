import { describe, it, expect } from 'vitest';
import { McpIdentityMapper } from '../../../src/integrations/mcp/adapters/McpIdentityMapper.js';
import { McpSessionManager } from '../../../src/integrations/mcp/adapters/McpSessionManager.js';
import { AgentSessionManager } from '../../../src/agent/runtime/AgentSessionManager.js';
import { AgentRegistry } from '../../../src/agent/runtime/AgentRegistry.js';
import { McpErrorCodes } from '../../../src/integrations/mcp/errors/McpErrorCodes.js';

describe('MCP Session & Identity Mapping', () => {
  it('maps Claude Desktop client info to Anthropic IDE_AGENT', () => {
    const agent = McpIdentityMapper.mapClientToAgent({
      name: 'claude-desktop',
      version: '1.2.3',
    });

    expect(agent.vendor).toBe('Anthropic');
    expect(agent.type).toBe('IDE_AGENT');
    expect(agent.version).toBe('1.2.3');
    expect(agent.agentId).toBe('mcp-claude-desktop');
    expect(agent.trustLevel).toBe('LIMITED');
  });

  it('maps Cursor client info to Anysphere IDE_AGENT', () => {
    const agent = McpIdentityMapper.mapClientToAgent({
      name: 'cursor-ide',
      version: '0.40.1',
    });

    expect(agent.vendor).toBe('Anysphere');
    expect(agent.type).toBe('IDE_AGENT');
  });

  it('initializes and resolves an active session correctly', async () => {
    const agentRegistry = new AgentRegistry();
    const sessionManager = new AgentSessionManager();
    const mcpSessionManager = new McpSessionManager({
      sessionManager,
      agentRegistry,
    });

    const context = await mcpSessionManager.initializeSession({
      workspaceId: 'ws-alpha',
      repositoryId: 'repo-omega',
      clientInfo: { name: 'claude-desktop', version: '1.0' },
    });

    expect(context.sessionId).toBeDefined();
    expect(context.workspaceId).toBe('ws-alpha');
    expect(context.repositoryId).toBe('repo-omega');
    expect(mcpSessionManager.getActiveSessionCount()).toBe(1);

    const resolved = await mcpSessionManager.resolveSession(context.sessionId);
    expect(resolved).toBeDefined();
    expect(resolved?.sessionContext.sessionId).toBe(context.sessionId);
    expect(resolved?.session?.status).toBe('ACTIVE');
  });

  it('enforces workspace and repository scope isolation', async () => {
    const mcpSessionManager = new McpSessionManager();
    const context = await mcpSessionManager.initializeSession({
      workspaceId: 'ws-main',
      repositoryId: 'repo-backend',
    });

    // Valid scope
    expect(() => {
      mcpSessionManager.validateSessionScope(context, 'ws-main', 'repo-backend');
    }).not.toThrow();

    // Mismatched workspace
    expect(() => {
      mcpSessionManager.validateSessionScope(context, 'ws-other', 'repo-backend');
    }).toThrowError(/Workspace scope violation/);

    // Mismatched repository
    expect(() => {
      mcpSessionManager.validateSessionScope(context, 'ws-main', 'repo-frontend');
    }).toThrowError(/Repository scope violation/);
  });

  it('expires inactive session after timeout', async () => {
    const mcpSessionManager = new McpSessionManager({
      sessionTimeoutMs: 20, // 20ms TTL
    });

    const context = await mcpSessionManager.initializeSession({
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
    });

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 30));

    await expect(mcpSessionManager.resolveSession(context.sessionId)).rejects.toMatchObject({
      code: McpErrorCodes.SESSION_EXPIRED,
    });

    expect(mcpSessionManager.getActiveSessionCount()).toBe(0);
  });

  it('closes session explicitly and decrements active count', async () => {
    const mcpSessionManager = new McpSessionManager();
    const context = await mcpSessionManager.initializeSession({
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
    });

    expect(mcpSessionManager.getActiveSessionCount()).toBe(1);
    const closed = await mcpSessionManager.closeSession(context.sessionId);
    expect(closed).toBe(true);
    expect(mcpSessionManager.getActiveSessionCount()).toBe(0);

    const resolved = await mcpSessionManager.resolveSession(context.sessionId);
    expect(resolved).toBeUndefined();
  });
});
