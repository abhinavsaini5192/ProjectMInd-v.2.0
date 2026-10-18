import { describe, it, expect } from 'vitest';
import { createObservationTestHarness } from './ObservationTestHelper.js';
import { ProjectMindGetExecutionObservationsHandler } from '../../../src/agent/observation/handlers/ProjectMindGetExecutionObservationsHandler.js';
import { ProjectMindGetTaskTimelineHandler } from '../../../src/agent/observation/handlers/ProjectMindGetTaskTimelineHandler.js';
import { ProjectMindGetExecutionSummaryHandler } from '../../../src/agent/observation/handlers/ProjectMindGetExecutionSummaryHandler.js';
import { ProjectMindGetObservationConflictsHandler } from '../../../src/agent/observation/handlers/ProjectMindGetObservationConflictsHandler.js';
import type { ToolRequest } from '../../../src/agent/protocol/models/ToolRequest.js';

describe('Phase 7.6 Observation Tool Handlers', () => {
  const harness = createObservationTestHarness();
  const getObsHandler = new ProjectMindGetExecutionObservationsHandler(harness.queryService);
  const timelineHandler = new ProjectMindGetTaskTimelineHandler(harness.queryService);
  const summaryHandler = new ProjectMindGetExecutionSummaryHandler(harness.queryService);
  const conflictsHandler = new ProjectMindGetObservationConflictsHandler(harness.queryService);

  const taskId = 'task-tool-handler-1';

  it('exposes accurate tool definitions from CANONICAL_TOOLS', () => {
    expect(getObsHandler.toolName).toBe('projectmind_get_execution_observations');
    expect(getObsHandler.getToolDefinition().name).toBe('projectmind_get_execution_observations');

    expect(timelineHandler.toolName).toBe('projectmind_get_task_timeline');
    expect(timelineHandler.getToolDefinition().name).toBe('projectmind_get_task_timeline');

    expect(summaryHandler.toolName).toBe('projectmind_get_execution_summary');
    expect(summaryHandler.getToolDefinition().name).toBe('projectmind_get_execution_summary');

    expect(conflictsHandler.toolName).toBe('projectmind_get_observation_conflicts');
    expect(conflictsHandler.getToolDefinition().name).toBe('projectmind_get_observation_conflicts');
  });

  const createMockToolRequest = (overrides: Partial<ToolRequest> & { toolName: string; arguments?: Record<string, unknown> }): ToolRequest => ({
    requestId: overrides.requestId ?? `req_${Math.random()}`,
    agentId: 'agent-1',
    protocolVersion: '1.0.0',
    workspaceId: 'ws-1',
    repositoryId: 'repo-1',
    timestamp: new Date().toISOString(),
    arguments: {},
    ...overrides,
  });

  it('executes projectmind_get_execution_observations successfully', async () => {
    await harness.processor.process({
      taskId,
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'COMMAND_EXECUTION',
      summary: 'Tool test command',
    });

    const request: ToolRequest = createMockToolRequest({
      requestId: 'req-1',
      toolName: 'projectmind_get_execution_observations',
      arguments: { taskId },
    });

    const result = (await getObsHandler.execute(request)) as any;
    expect(result.taskId).toBe(taskId);
    expect(result.totalObservations).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.observations)).toBe(true);
  });

  it('executes projectmind_get_task_timeline successfully', async () => {
    const request: ToolRequest = createMockToolRequest({
      requestId: 'req-2',
      toolName: 'projectmind_get_task_timeline',
      arguments: { taskId },
    });

    const result = (await timelineHandler.execute(request)) as any;
    expect(result.taskId).toBe(taskId);
    expect(Array.isArray(result.entries)).toBe(true);
  });

  it('executes projectmind_get_execution_summary successfully', async () => {
    const request: ToolRequest = createMockToolRequest({
      requestId: 'req-3',
      toolName: 'projectmind_get_execution_summary',
      arguments: { taskId },
    });

    const result = (await summaryHandler.execute(request)) as any;
    expect(result.taskId).toBe(taskId);
    expect(result.totalObservations).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('executes projectmind_get_observation_conflicts successfully', async () => {
    const request: ToolRequest = createMockToolRequest({
      requestId: 'req-4',
      toolName: 'projectmind_get_observation_conflicts',
      arguments: { taskId },
    });

    const result = (await conflictsHandler.execute(request)) as any;
    expect(result.taskId).toBe(taskId);
    expect(result.totalConflicts).toBeDefined();
    expect(Array.isArray(result.conflicts)).toBe(true);
  });

  it('rejects execution when required taskId is missing', async () => {
    const badRequest: ToolRequest = createMockToolRequest({
      requestId: 'req-bad',
      toolName: 'projectmind_get_execution_summary',
      arguments: {},
    });

    await expect(summaryHandler.execute(badRequest)).rejects.toThrow();
  });
});
