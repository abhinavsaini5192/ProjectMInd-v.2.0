import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime, createMockAgentSession } from './RuntimeTestHelper.js';
import { ProjectMindStartTaskHandler } from '../../../src/agent/runtime/handlers/ProjectMindStartTaskHandler.js';
import { ProjectMindGetTaskHandler } from '../../../src/agent/runtime/handlers/ProjectMindGetTaskHandler.js';
import { ProjectMindGetTaskStateHandler } from '../../../src/agent/runtime/handlers/ProjectMindGetTaskStateHandler.js';
import { ProjectMindGetTaskProgressHandler } from '../../../src/agent/runtime/handlers/ProjectMindGetTaskProgressHandler.js';
import { ProjectMindUpdateTaskHandler } from '../../../src/agent/runtime/handlers/ProjectMindUpdateTaskHandler.js';
import { ProjectMindCompleteTaskHandler } from '../../../src/agent/runtime/handlers/ProjectMindCompleteTaskHandler.js';
import { ProjectMindResumeTaskHandler } from '../../../src/agent/runtime/handlers/ProjectMindResumeTaskHandler.js';
import { ProjectMindCancelTaskHandler } from '../../../src/agent/runtime/handlers/ProjectMindCancelTaskHandler.js';
import { ProjectMindReportExecutionHandler } from '../../../src/agent/protocol/handlers/ProjectMindReportExecutionHandler.js';
import { ProjectMindReportVerificationHandler } from '../../../src/agent/protocol/handlers/ProjectMindReportVerificationHandler.js';
import type { ToolRequest } from '../../../src/agent/protocol/models/ToolRequest.js';

describe('Task Runtime Canonical Tool Handlers', () => {
  function makeRequest(toolName: string, args: Record<string, unknown>, session = createMockAgentSession()): ToolRequest {
    return {
      requestId: `req-${Date.now()}`,
      toolName,
      agentId: session.agentId,
      sessionId: session.sessionId,
      workspaceId: session.workspaceId,
      repositoryId: session.repositoryId,
      protocolVersion: '1.0.0',
      arguments: args,
      timestamp: new Date().toISOString(),
    };
  }

  it('executes start_task, get_task, get_task_state, and get_task_progress handlers', async () => {
    const { taskRuntime } = createTestTaskRuntime();
    const session = createMockAgentSession();

    // 1. start_task
    const startHandler = new ProjectMindStartTaskHandler(taskRuntime);
    expect(startHandler.getToolDefinition().name).toBe('projectmind_start_task');

    const startResult = await startHandler.execute(
      makeRequest('projectmind_start_task', {
        title: 'Tool handler test',
        description: 'Testing task tool handlers',
        intent: 'IMPLEMENTATION',
      }, session),
      session
    );

    const task = startResult['task'] as any;
    expect(task.taskId).toBeDefined();
    expect(task.status).toBe('IN_PROGRESS');

    // 2. get_task
    const getHandler = new ProjectMindGetTaskHandler(taskRuntime);
    const getResult = await getHandler.execute(
      makeRequest('projectmind_get_task', { taskId: task.taskId }, session),
      session
    );
    expect((getResult['task'] as any).taskId).toBe(task.taskId);

    // 3. get_task_state
    const getStateHandler = new ProjectMindGetTaskStateHandler(taskRuntime);
    const stateResult = await getStateHandler.execute(
      makeRequest('projectmind_get_task_state', { taskId: task.taskId }, session),
      session
    );
    expect((stateResult['snapshot'] as any).task.taskId).toBe(task.taskId);

    // 4. get_task_progress
    const getProgressHandler = new ProjectMindGetTaskProgressHandler(taskRuntime);
    const progressResult = await getProgressHandler.execute(
      makeRequest('projectmind_get_task_progress', { taskId: task.taskId }, session),
      session
    );
    expect((progressResult['progress'] as any).currentState).toBe('IN_PROGRESS');
  });

  it('executes update_task, resume_task, and cancel_task handlers', async () => {
    const { taskRuntime } = createTestTaskRuntime();
    const session = createMockAgentSession();

    const startHandler = new ProjectMindStartTaskHandler(taskRuntime);
    const startResult = await startHandler.execute(
      makeRequest('projectmind_start_task', {
        title: 'Initial Title',
        description: 'Testing updates',
      }, session),
      session
    );
    const taskId = (startResult['task'] as any).taskId;

    // update_task
    const updateHandler = new ProjectMindUpdateTaskHandler(taskRuntime);
    const updateResult = await updateHandler.execute(
      makeRequest('projectmind_update_task', {
        taskId,
        title: 'Updated Title',
        priority: 'HIGH',
      }, session),
      session
    );
    expect((updateResult['task'] as any).title).toBe('Updated Title');
    expect((updateResult['task'] as any).priority).toBe('HIGH');

    // cancel_task
    const cancelHandler = new ProjectMindCancelTaskHandler(taskRuntime);
    const cancelResult = await cancelHandler.execute(
      makeRequest('projectmind_cancel_task', {
        taskId,
        reason: 'Testing cancellation',
      }, session),
      session
    );
    expect(cancelResult['cancelled']).toBe(true);
    expect((cancelResult['task'] as any).status).toBe('CANCELLED');
  });

  it('routes report_execution and report_verification through TaskRuntime', async () => {
    const { taskRuntime } = createTestTaskRuntime();
    const session = createMockAgentSession();

    const startHandler = new ProjectMindStartTaskHandler(taskRuntime);
    const startResult = await startHandler.execute(
      makeRequest('projectmind_start_task', {
        title: 'Reporting Test Task',
        description: 'Testing reporting through TaskRuntime',
      }, session),
      session
    );
    const taskId = (startResult['task'] as any).taskId;

    // Report Execution
    const execHandler = new ProjectMindReportExecutionHandler(undefined, undefined, taskRuntime);
    const execResult = await execHandler.execute(
      makeRequest('projectmind_report_execution', {
        taskId,
        status: 'COMPLETED',
        summary: 'Finished coding auth fix',
        modifiedFiles: ['src/auth/AuthService.ts'],
      }, session),
      session
    );
    expect(execResult['acknowledged']).toBe(true);
    expect(execResult['filesCount']).toBe(1);

    // Report Verification
    const verifHandler = new ProjectMindReportVerificationHandler(undefined, taskRuntime);
    const verifResult = await verifHandler.execute(
      makeRequest('projectmind_report_verification', {
        taskId,
        passed: true,
        summary: 'Unit and integration tests passed',
        testResults: [{ name: 'Auth test', passed: true }],
      }, session),
      session
    );
    expect(verifResult['recorded']).toBe(true);
    expect(verifResult['status']).toBe('PASSED');

    // Complete Task
    const completeHandler = new ProjectMindCompleteTaskHandler(taskRuntime);
    const completeResult = await completeHandler.execute(
      makeRequest('projectmind_complete_task', { taskId }, session),
      session
    );
    expect(completeResult['completed']).toBe(true);
    expect((completeResult['task'] as any).status).toBe('COMPLETED');
  });
});
