import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../../src/agent/runtime/AgentRegistry.js';
import { AgentCapabilitySet } from '../../src/agent/models/AgentCapabilitySet.js';
import { AgentConflictError } from '../../src/agent/errors/AgentConflictError.js';
import { AgentNotFoundError } from '../../src/agent/errors/AgentNotFoundError.js';
import { AgentValidationError } from '../../src/agent/errors/AgentValidationError.js';
import { MockEventBus } from './AgentTestHelper.js';

describe('AgentRegistry', () => {
  let eventBus: MockEventBus;
  let registry: AgentRegistry;

  beforeEach(() => {
    eventBus = new MockEventBus();
    registry = new AgentRegistry(eventBus);
  });

  it('successfully registers an agent with default trustLevel and capabilities', async () => {
    const agent = await registry.register({
      agentId: 'claude_code_1',
      name: 'Claude Code Agent',
      type: 'CLI_AGENT',
      version: '1.2.0',
    });

    expect(agent.agentId).toBe('claude_code_1');
    expect(agent.name).toBe('Claude Code Agent');
    expect(agent.type).toBe('CLI_AGENT');
    expect(agent.version).toBe('1.2.0');
    expect(agent.status).toBe('ACTIVE');
    expect(agent.trustLevel).toBe('LIMITED');
    expect(agent.capabilities).toBeInstanceOf(AgentCapabilitySet);
    expect(agent.createdAt).toBeDefined();
    expect(agent.updatedAt).toBeDefined();

    const retrieved = await registry.get('claude_code_1');
    expect(retrieved).toEqual(agent);
  });

  it('allows specifying custom capabilities and trust level', async () => {
    const caps = new AgentCapabilitySet(['CONTEXT_REQUEST', 'FEATURE_QUERY']);
    const agent = await registry.register({
      agentId: 'cursor_agent',
      name: 'Cursor IDE Agent',
      type: 'IDE_AGENT',
      version: '0.42.0',
      capabilities: caps,
      trustLevel: 'TRUSTED',
      metadata: { theme: 'dark' },
    });

    expect(agent.trustLevel).toBe('TRUSTED');
    expect(agent.capabilities.has('CONTEXT_REQUEST')).toBe(true);
    expect(agent.capabilities.has('IMPACT_QUERY')).toBe(false);
    expect(agent.metadata).toEqual({ theme: 'dark' });
  });

  it('prevents registering duplicate active agents', async () => {
    await registry.register({
      agentId: 'dup_agent',
      name: 'Original Agent',
      type: 'CODING_AGENT',
      version: '1.0.0',
    });

    await expect(
      registry.register({
        agentId: 'dup_agent',
        name: 'Duplicate Agent',
        type: 'CODING_AGENT',
        version: '1.0.0',
      })
    ).rejects.toThrow(AgentConflictError);
  });

  it('validates mandatory parameters', async () => {
    await expect(
      registry.register({
        agentId: '',
        name: 'Test',
        type: 'CODING_AGENT',
        version: '1.0',
      })
    ).rejects.toThrow(AgentValidationError);

    await expect(
      registry.register({
        agentId: 'a1',
        name: '',
        type: 'CODING_AGENT',
        version: '1.0',
      })
    ).rejects.toThrow(AgentValidationError);

    await expect(
      registry.register({
        agentId: 'a1',
        name: 'Test',
        type: undefined as any,
        version: '1.0',
      })
    ).rejects.toThrow(AgentValidationError);

    await expect(
      registry.register({
        agentId: 'a1',
        name: 'Test',
        type: 'CODING_AGENT',
        version: '',
      })
    ).rejects.toThrow(AgentValidationError);
  });

  it('deregisters an agent and allows re-registration afterwards', async () => {
    await registry.register({
      agentId: 're_reg_agent',
      name: 'Ephemeral Agent',
      type: 'AUTOMATION_AGENT',
      version: '1.0.0',
    });

    const deregSuccess = await registry.deregister('re_reg_agent');
    expect(deregSuccess).toBe(true);

    const deregistered = await registry.get('re_reg_agent');
    expect(deregistered?.status).toBe('DEREGISTERED');

    const activeList = await registry.list();
    expect(activeList.find((a) => a.agentId === 're_reg_agent')).toBeUndefined();

    // Re-registration should succeed
    const reregistered = await registry.register({
      agentId: 're_reg_agent',
      name: 'Revived Agent',
      type: 'AUTOMATION_AGENT',
      version: '2.0.0',
    });
    expect(reregistered.status).toBe('ACTIVE');
    expect(reregistered.version).toBe('2.0.0');
  });

  it('throws AgentNotFoundError when deregistering non-existent agent', async () => {
    await expect(registry.deregister('unknown_id')).rejects.toThrow(AgentNotFoundError);
  });

  it('updates agent status and capabilities', async () => {
    await registry.register({
      agentId: 'upd_agent',
      name: 'Updateable',
      type: 'CODING_AGENT',
      version: '1.0.0',
    });

    const suspended = await registry.updateStatus('upd_agent', 'SUSPENDED');
    expect(suspended.status).toBe('SUSPENDED');

    const newCaps = new AgentCapabilitySet(['CONTEXT_REFRESH', 'KNOWLEDGE_UPDATE']);
    const updatedCaps = await registry.updateCapabilities('upd_agent', newCaps);
    expect(updatedCaps.capabilities.has('KNOWLEDGE_UPDATE')).toBe(true);
  });
});
