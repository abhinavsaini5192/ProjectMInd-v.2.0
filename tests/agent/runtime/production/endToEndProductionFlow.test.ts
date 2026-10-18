import { describe, it, expect } from 'vitest';
import { createTestProductionRuntime, createMockAgent } from './ProductionRuntimeTestHelper.js';
import type { ToolRequest } from '../../../../src/agent/protocol/models/ToolRequest.js';

describe('ProductionAgentRuntime - End-to-End Closed-Loop Production Flow', () => {
  it('executes full closed-loop lifecycle from session initiation to task completion and shutdown', async () => {
    // 1. Setup & initialization
    const ctx = createTestProductionRuntime();
    expect(ctx.runtime.getState()).toBe('CREATED');

    await ctx.runtime.initialize();
    expect(ctx.runtime.getState()).toBe('READY');

    await ctx.runtime.start();
    expect(ctx.runtime.getState()).toBe('RUNNING');

    const agent = createMockAgent('agent-production-1');
    const scope = {
      workspaceId: 'ws_prod',
      repositoryId: 'repo_prod',
    };

    // 2. Session Creation
    const session = await ctx.runtime.createSession(
      {
        workspaceId: scope.workspaceId,
        repositoryId: scope.repositoryId,
        agentId: agent.agentId,
        metadata: { client: 'vscode-plugin' },
      },
      agent
    );
    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('ACTIVE');

    // 3. Task Submission
    const taskScope = {
      ...scope,
      agentSessionId: session.sessionId,
    };
    const startResult = await ctx.runtime.submitTask(
      {
        ...taskScope,
        title: 'Implement Security Fix',
        description: 'Sanitize tenant query inputs',
        intent: 'Fix SQL/NoSQL injection possibility',
      },
      taskScope
    );
    const taskId = startResult.task.taskId;
    expect(taskId).toBeDefined();
    expect(startResult.task.status).toBe('READY');

    // 4. Initial Context Retrieval
    const initialContext = await ctx.runtime.getContext('ctx_sess_1', { autoRefreshIfStale: true });
    expect(initialContext.contextPackage).toBeDefined();
    expect(initialContext.contextVersion).toBe(1);

    // 5. Tool Execution & Observation
    const toolReq: ToolRequest = {
      requestId: 'req_tool_1',
      toolName: 'projectmind_get_architecture',
      agentId: agent.agentId,
      sessionId: session.sessionId,
      protocolVersion: '1.0.0',
      arguments: {},
      workspaceId: scope.workspaceId,
      repositoryId: scope.repositoryId,
      timestamp: new Date().toISOString(),
    };
    const toolRes = await ctx.runtime.executeTool(toolReq, session);
    expect(toolRes.success).toBe(true);

    // 6. Execution Report (Phase 7.6 Observation bridge)
    const coordinator = (ctx.runtime as any).coordinator;
    const reportResult = await coordinator.observation.recordExecutionReport(
      {
        taskId,
        status: 'COMPLETED',
        summary: 'Sanitized database query inputs',
        modifiedFiles: ['src/db/QueryBuilder.ts'],
      },
      taskScope
    );
    expect(reportResult.acknowledged).toBe(true);
    expect(reportResult.executionState.evidenceLevel).toBe('AGENT_REPORTED');

    // 7. Verification Report (Phase 7.7 Verification bridge)
    const verificationResult = await coordinator.verification.recordVerificationReport(
      {
        taskId,
        passed: true,
        summary: 'All unit & integration security tests passed',
      },
      taskScope
    );
    expect(verificationResult.recorded).toBe(true);
    expect(verificationResult.status).toBe('PASSED');

    // 8. Context Refresh (Phase 7.8 Knowledge & Context loop)
    const refreshedContext = await ctx.runtime.refreshContext('ctx_sess_1');
    expect(refreshedContext.refreshedVersion).toBe(2);

    // 9. Task Completion
    const completedTask = await ctx.runtime.completeTask({ taskId }, taskScope);
    expect(completedTask.status).toBe('COMPLETED');

    // 10. Checkpoint Creation
    const checkpoint = await ctx.runtime.createCheckpoint('post-task-checkpoint');
    expect(checkpoint.checkpointId).toBeDefined();

    // 11. Session Termination
    await ctx.runtime.terminateSession(session.sessionId, scope);
    const activeSessions = await ctx.runtime.listActiveSessions(scope.workspaceId);
    expect(activeSessions.length).toBe(0);

    // 12. Graceful Shutdown
    await ctx.runtime.stop('Deployment finished');
    expect(ctx.runtime.getState()).toBe('STOPPED');

    // 13. Telemetry Verification
    const metrics = ctx.runtime.getMetrics();
    expect(metrics.completedTasks).toBe(1);
    expect(metrics.toolExecutions).toBe(1);
    expect(metrics.contextRefreshes).toBeGreaterThanOrEqual(1);
  });
});
