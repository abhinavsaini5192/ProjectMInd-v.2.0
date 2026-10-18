import { describe, it, expect, beforeEach } from 'vitest';
import { createToolPipeline } from '../../../src/agent/protocol/di/ToolDISetup.js';
import type { AgentToolPipeline } from '../../../src/agent/protocol/pipeline/AgentToolPipeline.js';
import {
  createMockToolRequest,
  createMockToolDependencies,
  createMockSession,
} from './ToolTestHelper.js';

describe('Tool Protocol End-to-End Workflow Integration', () => {
  let pipeline: AgentToolPipeline;
  let deps: ReturnType<typeof createMockToolDependencies>;

  beforeEach(() => {
    deps = createMockToolDependencies();
    pipeline = createToolPipeline(deps);
  });

  it('runs an end-to-end AI coding workflow: discover -> get context -> check impact -> report -> verify -> update knowledge', async () => {
    const session = createMockSession();

    // 1. Tool Discovery
    const discovery = pipeline.getRegistry().getDiscoveryInfo();
    expect(discovery.totalTools).toBe(36);


    // 2. Request context for a task
    const contextRequest = createMockToolRequest({
      toolName: 'projectmind_get_context',
      arguments: {
        taskId: 'task-implement-jwt-refresh',
        featureId: 'feat-auth',
        tokenBudget: 6000,
      },
    });
    const contextResponse = await pipeline.execute(contextRequest, session);
    expect(contextResponse.success).toBe(true);
    const contextResult = contextResponse.result as Record<string, unknown>;
    expect(contextResult['packageId']).toBeDefined();

    // 3. Inspect change impact
    const impactRequest = createMockToolRequest({
      toolName: 'projectmind_get_impact',
      arguments: {
        featureId: 'feat-auth',
        modifiedFiles: ['src/auth/token.ts'],
      },
    });
    const impactResponse = await pipeline.execute(impactRequest, session);
    expect(impactResponse.success).toBe(true);

    // 4. Report task execution
    const executionRequest = createMockToolRequest({
      toolName: 'projectmind_report_execution',
      sessionId: session.sessionId,
      arguments: {
        taskId: 'task-implement-jwt-refresh',
        status: 'COMPLETED',
        summary: 'Added token refresh mechanism and rotated keys',
        modifiedFiles: ['src/auth/token.ts'],
        operationId: 'op-exec-001',
      },
    });
    const executionResponse = await pipeline.execute(executionRequest, session);
    expect(executionResponse.success).toBe(true);

    // 5. Report verification results
    const verifyRequest = createMockToolRequest({
      toolName: 'projectmind_report_verification',
      sessionId: session.sessionId,
      arguments: {
        taskId: 'task-implement-jwt-refresh',
        passed: true,
        summary: 'All 15 token tests passed without regression',
        operationId: 'op-verify-001',
      },
    });
    const verifyResponse = await pipeline.execute(verifyRequest, session);
    expect(verifyResponse.success).toBe(true);

    // 6. Update project knowledge with discovered facts
    const knowledgeRequest = createMockToolRequest({
      toolName: 'projectmind_update_knowledge',
      sessionId: session.sessionId,
      arguments: {
        featureId: 'feat-auth',
        insights: ['Refresh tokens expire in 7 days and use sliding expiration'],
        confidence: 0.9,
        operationId: 'op-know-001',
      },
    });
    const knowledgeResponse = await pipeline.execute(knowledgeRequest, session);
    expect(knowledgeResponse.success).toBe(true);

    // Verify all 3 events were published
    const mockBus = deps.eventBus as any;
    expect(mockBus.events.some((e: any) => e.name === 'agent.execution.reported')).toBe(true);
    expect(mockBus.events.some((e: any) => e.name === 'agent.verification.reported')).toBe(true);
    expect(mockBus.events.some((e: any) => e.name === 'agent.knowledge.updated')).toBe(true);
  });
});
