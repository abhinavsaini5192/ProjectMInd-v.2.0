import { describe, it, expect, beforeEach } from 'vitest';
import { createTestSetup, createTestRequest, createAllCapabilities, MockEventBus } from './AgentTestHelper.js';
import type { AgentRuntime } from '../../src/agent/runtime/AgentRuntime.js';

describe('Agent Integration Events', () => {
  let eventBus: MockEventBus;
  let runtime: AgentRuntime;

  beforeEach(() => {
    const setup = createTestSetup();
    eventBus = setup.eventBus;
    runtime = setup.runtime;
  });

  it('publishes registration and status change events', async () => {
    const agent = await runtime.registerAgent({
      agentId: 'agent_events_1',
      name: 'Events Agent',
      type: 'CLI_AGENT',
      version: '1.0',
    });

    expect(eventBus.events.some((e) => e.name === 'agent.registered')).toBe(true);

    const session = await runtime.createSession({
      agentId: agent.agentId,
      workspaceId: 'ws_events',
      repositoryId: 'repo_events',
    });

    expect(eventBus.events.some((e) => e.name === 'agent.session.created')).toBe(true);

    await runtime.closeSession(session.sessionId);
    expect(eventBus.events.some((e) => e.name === 'agent.session.closed')).toBe(true);

    await runtime.deregisterAgent(agent.agentId);
    expect(eventBus.events.some((e) => e.name === 'agent.deregistered')).toBe(true);
  });

  it('publishes request received, completed, and failed events', async () => {
    await runtime.registerAgent({
      agentId: 'agent_op_events',
      name: 'Op Events Agent',
      type: 'CODING_AGENT',
      version: '1.0',
      trustLevel: 'TRUSTED',
      capabilities: createAllCapabilities(),
    });

    // Successful request
    const successReq = createTestRequest('GET_CONTEXT', { taskText: 'Fix bug' }, {
      agentId: 'agent_op_events',
    });
    const successResp = await runtime.executeOperation(successReq);
    expect(successResp.status).toBe('SUCCESS');

    expect(eventBus.events.some((e) => e.name === 'agent.request.received')).toBe(true);
    expect(eventBus.events.some((e) => e.name === 'agent.request.completed')).toBe(true);

    // Failed request (e.g. invalid featureId)
    const failReq = createTestRequest('GET_FEATURE', { featureId: '' }, {
      agentId: 'agent_op_events',
    });
    const failResp = await runtime.executeOperation(failReq);
    expect(failResp.status).toBe('ERROR');

    expect(eventBus.events.some((e) => e.name === 'agent.request.failed')).toBe(true);
  });
});
