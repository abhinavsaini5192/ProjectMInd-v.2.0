import { describe, it, expect, vi } from 'vitest';
import { ProjectMindUpdateKnowledgeHandler } from '../../../src/agent/protocol/handlers/ProjectMindUpdateKnowledgeHandler.js';
import type { IKnowledgeUpdateCoordinator } from '../../../src/knowledge/update/interfaces/IKnowledgeUpdateCoordinator.js';
import type { ToolRequest } from '../../../src/agent/protocol/models/ToolRequest.js';
import type { AgentSession } from '../../../src/agent/models/AgentSession.js';
import type { IEventBus } from '../../../src/workspace/interfaces/IEventBus.js';

describe('Tool Integration: projectmind_update_knowledge', () => {
  const dummyRequest: ToolRequest = {
    protocolVersion: '1.0',
    requestId: 'req-1',
    agentId: 'agent-codex',
    sessionId: 'sess-100',
    toolName: 'projectmind_update_knowledge',
    arguments: {
      featureId: 'feat-auth',
      insights: ['Token validation logic simplified', 'Added rate limiting guard'],
      confidence: 0.95,
      affectedResources: ['src/auth/token.ts'],
      updateType: 'FEATURE_BEHAVIOR_CHANGED',
      operationId: 'op-token-1',
    },
    workspaceId: 'ws-1',
    repositoryId: 'repo-1',
    timestamp: new Date().toISOString(),
  };

  const dummySession: AgentSession = {
    protocolVersion: '1.0',
    sessionId: 'sess-100',
    agentId: 'agent-codex',
    workspaceId: 'ws-1',
    repositoryId: 'repo-1',
    capabilities: { capabilities: new Set() } as any,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    metadata: {},
  };

  it('routes tool execution into IKnowledgeUpdateCoordinator and enriches return payload', async () => {
    const mockCoordinator: IKnowledgeUpdateCoordinator = {
      processKnowledgeUpdate: vi.fn().mockResolvedValue({
        updateId: 'upd-tool-1',
        status: 'APPLIED',
        success: true,
        partialSuccess: false,
        failure: false,
        appliedAreas: ['FEATURE_BEHAVIOR'],
        failedAreas: [],
        skippedAreas: [],
        affectedResources: ['src/auth/token.ts'],
        affectedFeatures: ['feat-auth'],
        newKnowledgeVersion: 'v1.0.3',
        invalidations: [],
        refreshDecisions: [],
        conflicts: [],
        warnings: [],
        errors: [],
        retryEligible: false,
        processedAt: Date.now(),
        metadata: {},
      }),
    } as any;

    const mockEventBus: IEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as any;

    const handler = new ProjectMindUpdateKnowledgeHandler(mockEventBus, mockCoordinator);

    const result = await handler.execute(dummyRequest, dummySession);

    expect(result['stored']).toBe(true);
    expect(result['featureId']).toBe('feat-auth');
    expect(result['updateId']).toBe('upd-tool-1');
    expect(result['knowledgeVersion']).toBe('v1.0.3');
    expect(result['status']).toBe('APPLIED');

    expect(mockCoordinator.processKnowledgeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: 'repo-1',
        affectedFeatures: ['feat-auth'],
        affectedResources: ['src/auth/token.ts'],
        updateType: 'FEATURE_BEHAVIOR_CHANGED',
        confidence: 0.95,
        provenance: 'AGENT_REPORTED',
      })
    );
  });

  it('preserves 100% backward compatibility when coordinator is omitted', async () => {
    const mockEventBus: IEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as any;

    const handler = new ProjectMindUpdateKnowledgeHandler(mockEventBus);

    const result = await handler.execute(dummyRequest, dummySession);

    expect(result['stored']).toBe(true);
    expect(result['featureId']).toBe('feat-auth');
    expect(result['updateId']).toBeUndefined();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });
});
