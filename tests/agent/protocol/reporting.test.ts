import { describe, it, expect, beforeEach } from 'vitest';
import { createToolPipeline } from '../../../src/agent/protocol/di/ToolDISetup.js';
import type { AgentToolPipeline } from '../../../src/agent/protocol/pipeline/AgentToolPipeline.js';
import {
  createMockToolRequest,
  createMockToolDependencies,
  createMockSession,
} from './ToolTestHelper.js';

describe('Reporting & Idempotency Protocol', () => {
  let pipeline: AgentToolPipeline;
  let deps: ReturnType<typeof createMockToolDependencies>;

  beforeEach(() => {
    deps = createMockToolDependencies();
    pipeline = createToolPipeline(deps);
  });

  it('verifies all reporting tools have REPORT_ONLY safety level', () => {
    const registry = pipeline.getRegistry();
    const reportExecutionTool = registry.getTool('projectmind_report_execution');
    const reportVerificationTool = registry.getTool('projectmind_report_verification');
    const updateKnowledgeTool = registry.getTool('projectmind_update_knowledge');

    expect(reportExecutionTool?.safetyLevel).toBe('REPORT_ONLY');
    expect(reportVerificationTool?.safetyLevel).toBe('REPORT_ONLY');
    expect(updateKnowledgeTool?.safetyLevel).toBe('REPORT_ONLY');
  });

  it('deduplicates reporting operations when client supplies operationId', async () => {
    const session = createMockSession();
    const operationId = 'op-unique-uuid-1234';

    const request1 = createMockToolRequest({
      toolName: 'projectmind_report_execution',
      sessionId: session.sessionId,
      arguments: {
        taskId: 'task-1',
        status: 'COMPLETED',
        summary: 'Finished unit test creation',
        operationId,
      },
    });

    // First call: executes handler and caches result
    const response1 = await pipeline.execute(request1, session);
    expect(response1.success).toBe(true);
    expect(response1.metadata.cached).toBe(false);

    // Second call: identical operationId should be served from idempotency cache
    const response2 = await pipeline.execute(request1, session);
    expect(response2.success).toBe(true);
    expect(response2.metadata.cached).toBe(true);
    expect(response2.result).toEqual(response1.result);

    // Verify eventBus was only called once!
    const mockBus = deps.eventBus as any;
    const executionEvents = mockBus.events.filter(
      (e: any) => e.name === 'agent.execution.reported'
    );
    expect(executionEvents).toHaveLength(1);
  });

  it('requires session and fails when reporting without sessionId', async () => {
    const request = createMockToolRequest({
      toolName: 'projectmind_report_verification',
      sessionId: undefined,
      arguments: {
        taskId: 'task-1',
        passed: true,
        summary: 'All pass',
      },
    });

    const response = await pipeline.execute(request);
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('TOOL_SCOPE_DENIED');
  });
});
