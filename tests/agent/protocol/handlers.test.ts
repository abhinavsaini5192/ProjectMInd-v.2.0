import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockToolRequest,
  createMockToolDependencies,
  createMockSession,
} from './ToolTestHelper.js';
import { ProjectMindGetContextHandler } from '../../../src/agent/protocol/handlers/ProjectMindGetContextHandler.js';
import { ProjectMindGetFeatureHandler } from '../../../src/agent/protocol/handlers/ProjectMindGetFeatureHandler.js';
import { ProjectMindGetFeatureContextHandler } from '../../../src/agent/protocol/handlers/ProjectMindGetFeatureContextHandler.js';
import { ProjectMindGetImpactHandler } from '../../../src/agent/protocol/handlers/ProjectMindGetImpactHandler.js';
import { ProjectMindGetArchitectureHandler } from '../../../src/agent/protocol/handlers/ProjectMindGetArchitectureHandler.js';
import { ProjectMindGetHistoryHandler } from '../../../src/agent/protocol/handlers/ProjectMindGetHistoryHandler.js';
import { ProjectMindGetHealthHandler } from '../../../src/agent/protocol/handlers/ProjectMindGetHealthHandler.js';
import { ProjectMindExplainContextHandler } from '../../../src/agent/protocol/handlers/ProjectMindExplainContextHandler.js';
import { ProjectMindRefreshContextHandler } from '../../../src/agent/protocol/handlers/ProjectMindRefreshContextHandler.js';
import { ProjectMindReportExecutionHandler } from '../../../src/agent/protocol/handlers/ProjectMindReportExecutionHandler.js';
import { ProjectMindReportVerificationHandler } from '../../../src/agent/protocol/handlers/ProjectMindReportVerificationHandler.js';
import { ProjectMindUpdateKnowledgeHandler } from '../../../src/agent/protocol/handlers/ProjectMindUpdateKnowledgeHandler.js';

describe('Canonical Tool Handlers', () => {
  let deps: ReturnType<typeof createMockToolDependencies>;

  beforeEach(() => {
    deps = createMockToolDependencies();
  });

  it('ProjectMindGetContextHandler delegates to IContextOrchestrator', async () => {
    const handler = new ProjectMindGetContextHandler(deps.contextOrchestrator);
    const request = createMockToolRequest({
      toolName: 'projectmind_get_context',
      arguments: {
        taskId: 'task-123',
        featureId: 'feat-auth',
        tokenBudget: 5000,
      },
    });

    const result = await handler.execute(request);
    expect(result['taskId']).toBe('task-123');
    expect(result['packageId']).toBeDefined();
    expect(result['tokensUsed']).toBeDefined();
  });

  it('ProjectMindGetFeatureHandler queries IFeatureKnowledgeAPI profile', async () => {
    const handler = new ProjectMindGetFeatureHandler(deps.featureKnowledgeApi);
    const request = createMockToolRequest({
      toolName: 'projectmind_get_feature',
      arguments: {
        featureId: 'feat-auth',
        includeDependencies: true,
      },
    });

    const result = await handler.execute(request);
    expect(result['found']).toBe(true);
    expect(result['feature']).toBeDefined();
  });

  it('ProjectMindGetFeatureContextHandler delegates to IContextOrchestrator getFeatureContextForTask', async () => {
    const handler = new ProjectMindGetFeatureContextHandler(deps.contextOrchestrator);
    const request = createMockToolRequest({
      toolName: 'projectmind_get_feature_context',
      arguments: {
        featureId: 'feat-auth',
      },
    });

    const result = await handler.execute(request);
    expect(result['featureId']).toBe('feat-auth');
    expect(result['packageId']).toBeDefined();
  });

  it('ProjectMindGetImpactHandler validates and queries change impact', async () => {
    const handler = new ProjectMindGetImpactHandler(deps.featureKnowledgeApi);

    // Validation rejection on empty arguments
    const invalidRequest = createMockToolRequest({
      toolName: 'projectmind_get_impact',
      arguments: {},
    });
    expect(() => handler.validate?.(invalidRequest)).toThrow(/requires either 'featureId'/);

    // Valid execution
    const validRequest = createMockToolRequest({
      toolName: 'projectmind_get_impact',
      arguments: {
        featureId: 'feat-auth',
        depth: 2,
      },
    });
    const result = await handler.execute(validRequest);
    expect(result['featureId']).toBe('feat-auth');
    expect(result['affectedFeatures']).toBeDefined();
  });

  it('ProjectMindGetArchitectureHandler queries architectural boundaries and components', async () => {
    const handler = new ProjectMindGetArchitectureHandler(deps.featureKnowledgeApi);
    const request = createMockToolRequest({
      toolName: 'projectmind_get_architecture',
      arguments: {
        featureId: 'feat-auth',
        maxDepth: 3,
      },
    });

    const result = await handler.execute(request);
    expect(result['featureId']).toBe('feat-auth');
    expect(result['components']).toBeDefined();
  });

  it('ProjectMindGetHistoryHandler queries milestone timeline', async () => {
    const handler = new ProjectMindGetHistoryHandler(deps.featureKnowledgeApi);
    const request = createMockToolRequest({
      toolName: 'projectmind_get_history',
      arguments: {
        featureId: 'feat-auth',
        limit: 10,
      },
    });

    const result = await handler.execute(request);
    expect(result['featureId']).toBe('feat-auth');
    expect(Array.isArray(result['timeline'])).toBe(true);
  });

  it('ProjectMindGetHealthHandler queries health score and risks', async () => {
    const handler = new ProjectMindGetHealthHandler(deps.featureKnowledgeApi);
    const request = createMockToolRequest({
      toolName: 'projectmind_get_health',
      arguments: {
        featureId: 'feat-auth',
      },
    });

    const result = await handler.execute(request);
    expect(result['featureId']).toBe('feat-auth');
    expect(typeof result['healthScore']).toBe('number');
    expect(result['stability']).toBeDefined();
  });

  it('ProjectMindExplainContextHandler delegates to context explanation', async () => {
    const handler = new ProjectMindExplainContextHandler(deps.contextOrchestrator);
    const request = createMockToolRequest({
      toolName: 'projectmind_explain_context',
      arguments: {
        packageId: 'pkg-123',
      },
    });

    const result = await handler.execute(request);
    expect(result['packageId']).toBe('pkg-123');
    expect(result['reasons']).toBeDefined();
  });

  it('ProjectMindRefreshContextHandler refreshes package with modified files', async () => {
    const handler = new ProjectMindRefreshContextHandler(deps.contextOrchestrator);
    const request = createMockToolRequest({
      toolName: 'projectmind_refresh_context',
      arguments: {
        packageId: 'pkg-123',
        modifiedFiles: ['src/auth/service.ts'],
      },
    });

    const result = await handler.execute(request);
    expect(result['packageId']).toBeDefined();
    expect(result['refreshed']).toBe(true);
    expect(result['changes']).toEqual(['src/auth/service.ts']);
  });

  it('ProjectMindReportExecutionHandler publishes event and returns acknowledgment', async () => {
    const handler = new ProjectMindReportExecutionHandler(deps.eventBus);
    const session = createMockSession();
    const request = createMockToolRequest({
      toolName: 'projectmind_report_execution',
      sessionId: session.sessionId,
      arguments: {
        taskId: 'task-123',
        status: 'COMPLETED',
        summary: 'Updated auth token handler',
        modifiedFiles: ['src/auth.ts'],
      },
    });

    const result = await handler.execute(request, session);
    expect(result['taskId']).toBe('task-123');
    expect(result['acknowledged']).toBe(true);

    const mockBus = deps.eventBus as any;
    expect(mockBus.events.some((e: any) => e.name === 'agent.execution.reported')).toBe(true);
  });

  it('ProjectMindReportVerificationHandler publishes verification event', async () => {
    const handler = new ProjectMindReportVerificationHandler(deps.eventBus);
    const session = createMockSession();
    const request = createMockToolRequest({
      toolName: 'projectmind_report_verification',
      sessionId: session.sessionId,
      arguments: {
        taskId: 'task-123',
        passed: true,
        summary: 'All unit tests passing',
      },
    });

    const result = await handler.execute(request, session);
    expect(result['taskId']).toBe('task-123');
    expect(result['passed']).toBe(true);
    expect(result['recorded']).toBe(true);

    const mockBus = deps.eventBus as any;
    expect(mockBus.events.some((e: any) => e.name === 'agent.verification.reported')).toBe(true);
  });

  it('ProjectMindUpdateKnowledgeHandler publishes knowledge update event', async () => {
    const handler = new ProjectMindUpdateKnowledgeHandler(deps.eventBus);
    const session = createMockSession();
    const request = createMockToolRequest({
      toolName: 'projectmind_update_knowledge',
      sessionId: session.sessionId,
      arguments: {
        featureId: 'feat-auth',
        insights: ['Uses RS256 signing for JWT tokens'],
        confidence: 0.95,
      },
    });

    const result = await handler.execute(request, session);
    expect(result['featureId']).toBe('feat-auth');
    expect(result['stored']).toBe(true);
    expect(result['insightsRecorded']).toBe(1);

    const mockBus = deps.eventBus as any;
    expect(mockBus.events.some((e: any) => e.name === 'agent.knowledge.updated')).toBe(true);
  });
});
