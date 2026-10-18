import { describe, it, expect } from 'vitest';
import { DIContainer } from '../../src/workspace/di/DIContainer.js';
import { AgentDISetup } from '../../src/agent/di/AgentDISetup.js';
import { AgentTokens } from '../../src/agent/di/AgentTokens.js';
import { AgentRuntime } from '../../src/agent/runtime/AgentRuntime.js';
import {
  MockContextOrchestrator,
  MockFeatureKnowledgeAPI,
  MockEventBus,
} from './AgentTestHelper.js';

describe('Agent DI Wiring', () => {
  it('registers all agent services in DIContainer and resolves AgentRuntime', () => {
    const container = new DIContainer();
    const eventBus = new MockEventBus();
    const contextOrchestrator = new MockContextOrchestrator();
    const featureKnowledgeApi = new MockFeatureKnowledgeAPI();

    AgentDISetup.register(container, {
      contextOrchestrator,
      featureKnowledgeApi,
      eventBus,
    });

    const runtime = container.resolve<AgentRuntime>(AgentTokens.IAgentRuntime);
    expect(runtime).toBeInstanceOf(AgentRuntime);

    const registry = container.resolve(AgentTokens.IAgentRegistry);
    expect(registry).toBeDefined();

    const router = container.resolve(AgentTokens.IAgentOperationRouter);
    expect(router).toBeDefined();
  });

  it('createRuntime factory builds a functional AgentRuntime directly', async () => {
    const runtime = AgentDISetup.createRuntime({
      contextOrchestrator: new MockContextOrchestrator(),
      featureKnowledgeApi: new MockFeatureKnowledgeAPI(),
      eventBus: new MockEventBus(),
    });

    expect(runtime).toBeInstanceOf(AgentRuntime);
    const agent = await runtime.registerAgent({
      agentId: 'direct_agent',
      name: 'Direct Agent',
      type: 'CLI_AGENT',
      version: '1.0',
    });
    expect(agent.agentId).toBe('direct_agent');
  });
});
