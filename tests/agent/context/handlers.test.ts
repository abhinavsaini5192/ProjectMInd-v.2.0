import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';
import { ProjectMindStartTaskContextHandler } from '../../../src/agent/context/handlers/ProjectMindStartTaskContextHandler.js';
import { ProjectMindGetCurrentContextHandler } from '../../../src/agent/context/handlers/ProjectMindGetCurrentContextHandler.js';
import { ProjectMindRefreshTaskContextHandler } from '../../../src/agent/context/handlers/ProjectMindRefreshTaskContextHandler.js';
import { ProjectMindUpdateTaskContextHandler } from '../../../src/agent/context/handlers/ProjectMindUpdateTaskContextHandler.js';
import { ProjectMindPinContextHandler } from '../../../src/agent/context/handlers/ProjectMindPinContextHandler.js';
import { ProjectMindUnpinContextHandler } from '../../../src/agent/context/handlers/ProjectMindUnpinContextHandler.js';
import { ProjectMindReportContextFeedbackHandler } from '../../../src/agent/context/handlers/ProjectMindReportContextFeedbackHandler.js';
import type { ToolRequest } from '../../../src/agent/protocol/models/ToolRequest.js';

describe('Canonical Context Tool Handlers', () => {
  it('executes all 7 context tool handlers through the tool interface', async () => {
    const harness = createContextHarness();

    const startHandler = new ProjectMindStartTaskContextHandler(harness.sessionManager);
    const getCurrentHandler = new ProjectMindGetCurrentContextHandler(harness.sessionManager);
    const refreshHandler = new ProjectMindRefreshTaskContextHandler(harness.sessionManager);
    const updateHandler = new ProjectMindUpdateTaskContextHandler(harness.sessionManager);
    const pinHandler = new ProjectMindPinContextHandler(harness.sessionManager);
    const unpinHandler = new ProjectMindUnpinContextHandler(harness.sessionManager);
    const feedbackHandler = new ProjectMindReportContextFeedbackHandler(harness.sessionManager);

    // 1. start_task_context
    const startReq: ToolRequest = {
      requestId: 'req-start',
      protocolVersion: '1.0',
      toolName: 'projectmind_start_task_context',
      arguments: {
        taskText: 'Refactor authentication cookies',
      },
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      timestamp: new Date().toISOString(),
    };

    const startRes = await startHandler.execute(startReq);
    expect(startRes['contextSession']).toBeDefined();
    expect(startRes['task']).toBeDefined();
    const contextSessionId = (startRes['contextSession'] as any).contextSessionId;

    // 2. pin_context
    const pinReq: ToolRequest = {
      ...startReq,
      toolName: 'projectmind_pin_context',
      arguments: {
        contextSessionId,
        type: 'FEATURE',
        targetId: 'feat-auth',
        reason: 'Keep auth active',
      },
    };
    const pinRes = await pinHandler.execute(pinReq);
    expect(pinRes['pinned']).toBe(true);
    const pinId = String(pinRes['pinId']);

    // 3. unpin_context
    const unpinReq: ToolRequest = {
      ...startReq,
      toolName: 'projectmind_unpin_context',
      arguments: {
        contextSessionId,
        pinId,
      },
    };
    const unpinRes = await unpinHandler.execute(unpinReq);
    expect(unpinRes['unpinned']).toBe(true);

    // 4. refresh_task_context
    const refreshReq: ToolRequest = {
      ...startReq,
      toolName: 'projectmind_refresh_task_context',
      arguments: {
        contextSessionId,
        reason: 'RESOURCE_CHANGED',
        modifiedFiles: ['src/auth/AuthService.ts'],
      },
    };
    const refreshRes = await refreshHandler.execute(refreshReq);
    expect(refreshRes['refreshedVersion']).toBe(2);

    // 5. update_task_context
    const updateReq: ToolRequest = {
      ...startReq,
      toolName: 'projectmind_update_task_context',
      arguments: {
        contextSessionId,
        newTaskText: 'Refactor authentication cookies and session headers',
        newIntent: 'REFACTORING',
      },
    };
    const updateRes = await updateHandler.execute(updateReq);
    expect(updateRes['updatedContextVersion']).toBe(3);

    // 6. get_current_context
    const getReq: ToolRequest = {
      ...startReq,
      toolName: 'projectmind_get_current_context',
      arguments: {
        contextSessionId,
        includeDelta: true,
        baseContextVersion: 1,
      },
    };
    const getRes = await getCurrentHandler.execute(getReq);
    expect(getRes['contextVersion']).toBe(3);
    expect(getRes['delta']).toBeDefined();

    // 7. report_context_feedback
    const feedbackReq: ToolRequest = {
      ...startReq,
      toolName: 'projectmind_report_context_feedback',
      arguments: {
        contextSessionId,
        rating: 'USEFUL',
        comments: 'Context had everything needed',
      },
    };
    const feedbackRes = await feedbackHandler.execute(feedbackReq);
    expect(feedbackRes['recorded']).toBe(true);
    expect(feedbackRes['rating']).toBe('USEFUL');
  });
});
