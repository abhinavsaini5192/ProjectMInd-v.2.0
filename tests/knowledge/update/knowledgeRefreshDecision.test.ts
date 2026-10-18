import { describe, it, expect, vi } from 'vitest';
import { KnowledgeRefreshManager } from '../../../src/knowledge/update/core/KnowledgeRefreshManager.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';
import { KNOWLEDGE_UPDATE_EVENTS } from '../../../src/knowledge/update/events/KnowledgeUpdateEvents.js';
import type { IAgentContextSessionManager } from '../../../src/agent/context/interfaces/IAgentContextSessionManager.js';
import type { IEventBus } from '../../../src/workspace/interfaces/IEventBus.js';
import type { KnowledgeUpdate } from '../../../src/knowledge/update/models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../../../src/knowledge/update/models/KnowledgeUpdatePlan.js';

describe('KnowledgeRefreshManager', () => {
  const repository = new InMemoryKnowledgeUpdateRepository();
  const mockContextSessionManager: IAgentContextSessionManager = {
    markContextStale: vi.fn().mockResolvedValue(undefined),
  } as any;
  const mockEventBus: IEventBus = {
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  } as any;

  const manager = new KnowledgeRefreshManager({
    repository,
    contextSessionManager: mockContextSessionManager,
    eventBus: mockEventBus,
  });

  const dummyPlan: KnowledgeUpdatePlan = {
    planId: 'plan-1',
    updateId: 'upd-1',
    targetResources: ['src/auth.ts'],
    targetFeatures: ['feat-auth'],
    targetKnowledgeAreas: ['FEATURE_MAPPING'],
    operations: [],
    invalidationTargets: ['feat-auth'],
    refreshTargets: ['feat-auth'],
    confidence: 0.9,
    warnings: [],
    conflicts: [],
    skippedAreas: [],
    reasonCodes: [],
    createdAt: Date.now(),
  };

  it('determines NO_REFRESH_REQUIRED when no features or resources are affected', async () => {
    const update: KnowledgeUpdate = {
      updateId: 'upd-0',
      repositoryId: 'repo-1',
      source: 'MANUAL',
      provenance: 'MANUALLY_CONFIRMED',
      updateType: 'RESOURCE_CHANGED',
      status: 'RECEIVED',
      affectedResources: [],
      affectedFeatures: [],
      affectedKnowledgeAreas: [],
      evidenceReferences: [],
      requestedAt: Date.now(),
      observedAt: Date.now(),
      idempotencyKey: 'k0',
      confidence: 1.0,
      retryCount: 0,
      metadata: {},
    };

    const decision = await manager.determineRefreshPolicy(update, dummyPlan, [], []);
    expect(decision.policy).toBe('NO_REFRESH_REQUIRED');
  });

  it('determines REFRESH_CURRENT_SESSION and marks context stale when agentSessionId is present', async () => {
    const update: KnowledgeUpdate = {
      updateId: 'upd-session',
      agentSessionId: 'sess-123',
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      provenance: 'AGENT_REPORTED',
      updateType: 'RESOURCE_CHANGED',
      status: 'RECEIVED',
      affectedResources: ['src/auth.ts'],
      affectedFeatures: ['feat-auth'],
      affectedKnowledgeAreas: ['FEATURE_MAPPING'],
      evidenceReferences: [],
      requestedAt: Date.now(),
      observedAt: Date.now(),
      idempotencyKey: 'k1',
      confidence: 0.9,
      retryCount: 0,
      metadata: {},
    };

    const decision = await manager.determineRefreshPolicy(update, dummyPlan, ['feat-auth'], ['src/auth.ts']);
    expect(decision.policy).toBe('REFRESH_CURRENT_SESSION');
    expect(decision.targetSessionId).toBe('sess-123');

    await manager.applyRefreshDecision(decision);
    expect(mockContextSessionManager.markContextStale).toHaveBeenCalledWith('sess-123', 'FEATURE_CHANGED');
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      KNOWLEDGE_UPDATE_EVENTS.REFRESH_REQUESTED,
      expect.objectContaining({ eventName: KNOWLEDGE_UPDATE_EVENTS.REFRESH_REQUESTED })
    );
  });

  it('determines REFRESH_ON_NEXT_REQUEST when only taskId is present', async () => {
    const update: KnowledgeUpdate = {
      updateId: 'upd-task',
      taskId: 'task-999',
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      provenance: 'AGENT_REPORTED',
      updateType: 'RESOURCE_CHANGED',
      status: 'RECEIVED',
      affectedResources: ['src/auth.ts'],
      affectedFeatures: ['feat-auth'],
      affectedKnowledgeAreas: ['FEATURE_MAPPING'],
      evidenceReferences: [],
      requestedAt: Date.now(),
      observedAt: Date.now(),
      idempotencyKey: 'k2',
      confidence: 0.9,
      retryCount: 0,
      metadata: {},
    };

    const decision = await manager.determineRefreshPolicy(update, dummyPlan, ['feat-auth'], ['src/auth.ts']);
    expect(decision.policy).toBe('REFRESH_ON_NEXT_REQUEST');
  });

  it('determines INVALIDATE_ONLY when neither session nor task is present', async () => {
    const update: KnowledgeUpdate = {
      updateId: 'upd-global',
      repositoryId: 'repo-1',
      source: 'MANUAL',
      provenance: 'MANUALLY_CONFIRMED',
      updateType: 'RESOURCE_CHANGED',
      status: 'RECEIVED',
      affectedResources: ['src/auth.ts'],
      affectedFeatures: ['feat-auth'],
      affectedKnowledgeAreas: ['FEATURE_MAPPING'],
      evidenceReferences: [],
      requestedAt: Date.now(),
      observedAt: Date.now(),
      idempotencyKey: 'k3',
      confidence: 1.0,
      retryCount: 0,
      metadata: {},
    };

    const decision = await manager.determineRefreshPolicy(update, dummyPlan, ['feat-auth'], ['src/auth.ts']);
    expect(decision.policy).toBe('INVALIDATE_ONLY');
  });
});
