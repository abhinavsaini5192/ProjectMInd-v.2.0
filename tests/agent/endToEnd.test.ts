import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestSetup,
  createTestRequest,
  createAllCapabilities,
} from './AgentTestHelper.js';
import type { AgentRuntime } from '../../src/agent/runtime/AgentRuntime.js';

describe('Agent Integration End-to-End Flow', () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    const setup = createTestSetup();
    runtime = setup.runtime;
  });

  it('executes the complete agent integration lifecycle', async () => {
    // 1. Register agent
    const agent = await runtime.registerAgent({
      agentId: 'claude_code_e2e',
      name: 'Claude Code Assistant',
      type: 'CLI_AGENT',
      version: '1.5.0',
      vendor: 'Anthropic',
      trustLevel: 'TRUSTED',
      capabilities: createAllCapabilities(),
    });
    expect(agent.status).toBe('ACTIVE');

    // 2. Create session
    const session = await runtime.createSession({
      agentId: agent.agentId,
      workspaceId: 'ws_prod',
      repositoryId: 'repo_projectmind',
      branch: 'feature/agent-integration',
      commit: 'git9999',
      taskId: 'task_e2e_01',
    });
    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('ACTIVE');

    // 3. Request Context
    const contextRequest = createTestRequest(
      'GET_CONTEXT',
      { taskText: 'Implement agent bridge' },
      {
        agentId: agent.agentId,
        sessionId: session.sessionId,
        workspaceContext: { workspaceId: 'ws_prod', repositoryId: 'repo_projectmind' },
      }
    );
    const contextResponse = await runtime.executeOperation(contextRequest);
    expect(contextResponse.status).toBe('SUCCESS');
    expect(contextResponse.data).toBeDefined();
    expect(contextResponse.metadata.durationMs).toBeGreaterThanOrEqual(0);
    expect(contextResponse.metadata.protocolVersion).toBe('1.0');

    // 4. Request Feature Knowledge
    const featureRequest = createTestRequest(
      'GET_FEATURE',
      { featureId: 'feature_context_orchestration' },
      {
        agentId: agent.agentId,
        sessionId: session.sessionId,
        workspaceContext: { workspaceId: 'ws_prod', repositoryId: 'repo_projectmind' },
      }
    );
    const featureResponse = await runtime.executeOperation(featureRequest);
    expect(featureResponse.status).toBe('SUCCESS');
    expect((featureResponse.data as any).profile.featureId).toBe('feature_context_orchestration');

    // 5. Request Impact Analysis
    const impactRequest = createTestRequest(
      'GET_IMPACT',
      { featureId: 'feature_context_orchestration' },
      {
        agentId: agent.agentId,
        sessionId: session.sessionId,
        workspaceContext: { workspaceId: 'ws_prod', repositoryId: 'repo_projectmind' },
      }
    );
    const impactResponse = await runtime.executeOperation(impactRequest);
    expect(impactResponse.status).toBe('SUCCESS');
    expect((impactResponse.data as any).data.impactedFeatures[0].targetId).toBe('feature_b');

    // 6. Report Execution
    const execRequest = createTestRequest(
      'REPORT_EXECUTION',
      { status: 'COMPLETED', changedFiles: ['src/agent/runtime/AgentRuntime.ts'] },
      {
        agentId: agent.agentId,
        sessionId: session.sessionId,
        workspaceContext: { workspaceId: 'ws_prod', repositoryId: 'repo_projectmind' },
      }
    );
    const execResponse = await runtime.executeOperation(execRequest);
    expect(execResponse.status).toBe('SUCCESS');
    expect((execResponse.data as any).recorded).toBe(true);

    // 7. Report Verification
    const verifRequest = createTestRequest(
      'REPORT_VERIFICATION',
      { passed: true, testResults: [{ suite: 'e2e', passed: true }] },
      {
        agentId: agent.agentId,
        sessionId: session.sessionId,
        workspaceContext: { workspaceId: 'ws_prod', repositoryId: 'repo_projectmind' },
      }
    );
    const verifResponse = await runtime.executeOperation(verifRequest);
    expect(verifResponse.status).toBe('SUCCESS');
    expect((verifResponse.data as any).passed).toBe(true);

    // 8. Close session
    const closed = await runtime.closeSession(session.sessionId);
    expect(closed).toBe(true);

    // Further operation on closed session should fail
    const closedOpRequest = createTestRequest(
      'GET_CONTEXT',
      { taskText: 'After close' },
      {
        agentId: agent.agentId,
        sessionId: session.sessionId,
        workspaceContext: { workspaceId: 'ws_prod', repositoryId: 'repo_projectmind' },
      }
    );
    const closedOpResponse = await runtime.executeOperation(closedOpRequest);
    expect(closedOpResponse.status).toBe('ERROR');
    expect(closedOpResponse.error?.code).toBe('AGENT_OPERATION_ERROR');

    // 9. Deregister agent
    const dereg = await runtime.deregisterAgent(agent.agentId);
    expect(dereg).toBe(true);
  });
});
