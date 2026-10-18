import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductionBootstrap } from '../../src/platform/bootstrap/ProductionBootstrap.js';
import type { Agent } from '../../src/agent/models/Agent.js';
import { AgentCapabilitySet } from '../../src/agent/models/AgentCapabilitySet.js';
import type { ToolRequest } from '../../src/agent/protocol/models/ToolRequest.js';
import * as fs from 'fs';
import * as path from 'path';

function createMockAgent(agentId: string = 'agent-prod-1'): Agent {
  return {
    agentId,
    name: 'Production Claude Agent',
    type: 'CODING_AGENT',
    status: 'ACTIVE',
    trustLevel: 'TRUSTED',
    version: '1.0.0',
    capabilities: new AgentCapabilitySet(['READ_CONTEXT', 'EXECUTE_TOOL', 'REPORT_EXECUTION']),
    metadata: { environment: 'production' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('Phase 8.1 End-to-End Production Closed-Loop Lifecycle', () => {
  const testDir = path.resolve(process.cwd(), '.projectmind_test_e2e_prod');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error on Windows lock
    }
  });

  it('completes the full 24-step closed-loop production lifecycle', async () => {
    // 1-5: Bootstrap platform with production configuration
    const platform = await ProductionBootstrap.bootstrap({
      workspacePath: testDir,
      disableSignalHandlers: true,
      configOverrides: {
        app: {
          name: 'projectmind-prod-e2e',
          env: 'production',
          logLevel: 'INFO',
        },
        storage: {
          type: 'memory',
        },
        runtime: {
          contextRefreshPolicy: 'ON_NEXT_REQUEST',
          shutdownTimeoutMs: 15000,
        },
        security: {
          masterKey: '0123456789abcdef0123456789abcdef',
        },
      },
    });

    expect(platform.config.app.env).toBe('production');
    await platform.start();
    expect(platform.lifecycle.getState()).toBe('READY');

    const runtime = platform.getAgentRuntime();
    const workspaceId = testDir;
    const repositoryId = 'default-repo';
    const agent = createMockAgent('agent-prod-claude');

    // 6-7: Start agent session
    const session = await runtime.createSession(
      {
        workspaceId,
        repositoryId,
        agentId: agent.agentId,
        metadata: { client: 'agent-adapter-cli' },
      },
      agent
    );
    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('ACTIVE');

    // 8: Start task: "Fix the login timeout issue"
    const taskScope = {
      workspaceId,
      repositoryId,
      agentSessionId: session.sessionId,
    };
    const startResult = await runtime.submitTask(
      {
        workspaceId,
        repositoryId,
        agentSessionId: session.sessionId,
        title: 'Fix the login timeout issue',
        description: 'Increase timeout tolerance and retry count in AuthService.login',
        intent: 'Fix login timeout issue',
      },
      taskScope
    );
    const taskId = startResult.task.taskId;
    expect(taskId).toBeDefined();

    // 9: Retrieve initial context
    const contextSessionId = startResult.task.contextSessionId ?? 'ctx_prod_session_1';
    const initialContext = await runtime.getContext(contextSessionId, { autoRefreshIfStale: true });
    expect(initialContext.contextPackage).toBeDefined();

    // 10: Execute Tool
    const toolReq: ToolRequest = {
      requestId: 'req_tool_prod_1',
      toolName: 'projectmind_get_context',
      agentId: agent.agentId,
      sessionId: session.sessionId,
      protocolVersion: '1.0.0',
      arguments: {},
      workspaceId,
      repositoryId,
      timestamp: new Date().toISOString(),
    };
    const toolRes = await runtime.executeTool(toolReq, session);
    expect(toolRes.requestId).toBe('req_tool_prod_1');

    // 11: Observation enters system
    const coordinator = (runtime as any).coordinator;
    const reportResult = await coordinator.observation.recordExecutionReport(
      {
        taskId,
        status: 'COMPLETED',
        summary: 'Modified AuthService.login timeout and backoff logic',
        modifiedFiles: ['src/auth/AuthService.ts'],
      },
      taskScope
    );
    expect(reportResult.acknowledged).toBe(true);
    expect(reportResult.executionState.executionState).toBe('COMPLETED');

    // 12: Verification enters system
    const verificationResult = await coordinator.verification.recordVerificationReport(
      {
        taskId,
        passed: true,
        summary: 'All login timeout unit and integration tests passed',
      },
      taskScope
    );
    expect(verificationResult.recorded).toBe(true);
    expect(verificationResult.status).toBe('PASSED');

    // 13-17: Context Refresh & Knowledge update loop
    const refreshedContext = await runtime.refreshContext(contextSessionId);
    expect(refreshedContext.package).toBeDefined();
    expect(refreshedContext.refreshedVersion).toBeGreaterThanOrEqual(1);

    // 18: Task completes
    const completedTask = await runtime.completeTask({ taskId }, taskScope);
    expect(completedTask.status).toBe('COMPLETED');

    // 19-20: Graceful shutdown & state checkpointing
    const checkpoint = await runtime.createCheckpoint('prod_shutdown_chkpt');
    expect(checkpoint.checkpointId).toBeDefined();

    await platform.shutdown('End-to-end production test checkpoint');
    expect(platform.lifecycle.getState()).toBe('STOPPED');

    // 21-24: Restart platform & recover state
    const restartedPlatform = await ProductionBootstrap.bootstrap({
      workspacePath: testDir,
      disableSignalHandlers: true,
      configOverrides: {
        app: {
          name: 'projectmind-prod-e2e',
          env: 'production',
          logLevel: 'INFO',
        },
        storage: {
          type: 'memory',
        },
        security: {
          masterKey: '0123456789abcdef0123456789abcdef',
        },
      },
    });

    await restartedPlatform.start();
    expect(restartedPlatform.lifecycle.getState()).toBe('READY');

    const restartedRuntime = restartedPlatform.getAgentRuntime();
    const recoveryResult = await restartedRuntime.recover(checkpoint.checkpointId);
    expect(recoveryResult.status).toBe('RECOVERED');

    // Verify platform is healthy and ready after recovery
    const postHealth = await restartedPlatform.getHealth();
    expect(postHealth.status).toBe('HEALTHY');

    const postReadiness = await restartedPlatform.getReadiness();
    expect(postReadiness.ready).toBe(true);

    await restartedPlatform.shutdown('Test completed');
    expect(restartedPlatform.lifecycle.getState()).toBe('STOPPED');
  });
});
