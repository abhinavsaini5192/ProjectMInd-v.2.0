import type { ToolRequest } from '../../../src/agent/protocol/models/ToolRequest.js';
import type { AgentSession } from '../../../src/agent/models/AgentSession.js';
import type { Agent } from '../../../src/agent/models/Agent.js';
import { AgentCapabilitySet } from '../../../src/agent/models/AgentCapabilitySet.js';
import { AGENT_CAPABILITIES } from '../../../src/agent/models/AgentCapability.js';
import type { ToolPipelineDependencies } from '../../../src/agent/protocol/di/ToolDISetup.js';
import {
  MockEventBus,
  MockContextOrchestrator,
  MockFeatureKnowledgeAPI,
} from '../AgentTestHelper.js';

export function createMockToolRequest(overrides?: Partial<ToolRequest>): ToolRequest {
  return {
    requestId: 'req-test-001',
    agentId: 'test-agent',
    protocolVersion: '1.0',
    toolName: 'projectmind_get_context',
    arguments: {
      taskId: 'task-auth-001',
    },
    workspaceId: 'ws-test',
    repositoryId: 'repo-test',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockToolDependencies(overrides?: Partial<ToolPipelineDependencies>): ToolPipelineDependencies {
  return {
    contextOrchestrator: new MockContextOrchestrator(),
    featureKnowledgeApi: new MockFeatureKnowledgeAPI(),
    eventBus: new MockEventBus(),
    ...overrides,
  };
}

export function createMockSession(overrides?: Partial<AgentSession>): AgentSession {
  return {
    sessionId: 'session-test-001',
    agentId: 'test-agent',
    workspaceId: 'ws-test',
    repositoryId: 'repo-test',
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    status: 'ACTIVE',
    capabilities: new AgentCapabilitySet(AGENT_CAPABILITIES),
    protocolVersion: '1.0',
    ...overrides,
  };
}

export function createMockAgent(overrides?: Partial<Agent>): Agent {
  const now = new Date().toISOString();
  return {
    agentId: 'test-agent',
    name: 'Test AI Assistant',
    type: 'CLI_AGENT',
    version: '1.0.0',
    capabilities: new AgentCapabilitySet(AGENT_CAPABILITIES),
    trustLevel: 'TRUSTED',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
