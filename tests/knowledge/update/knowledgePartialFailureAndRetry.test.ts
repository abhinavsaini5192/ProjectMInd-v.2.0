import { describe, it, expect } from 'vitest';
import { KnowledgeUpdateProcessor } from '../../../src/knowledge/update/core/KnowledgeUpdateProcessor.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';
import { KnowledgeVersionManager } from '../../../src/knowledge/update/core/KnowledgeVersionManager.js';
import { KnowledgeInvalidationManager } from '../../../src/knowledge/update/core/KnowledgeInvalidationManager.js';
import { KnowledgeRefreshManager } from '../../../src/knowledge/update/core/KnowledgeRefreshManager.js';
import type { IKnowledgeUpdateExecutor } from '../../../src/knowledge/update/interfaces/IKnowledgeUpdateProcessor.js';
import type { KnowledgeUpdate } from '../../../src/knowledge/update/models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../../../src/knowledge/update/models/KnowledgeUpdatePlan.js';

describe('Knowledge Partial Failure & Retry', () => {
  it('records PARTIALLY_APPLIED status when some areas fail execution while others succeed', async () => {
    const repository = new InMemoryKnowledgeUpdateRepository();
    const versionManager = new KnowledgeVersionManager(repository);
    const invalidationManager = new KnowledgeInvalidationManager(repository);
    const refreshManager = new KnowledgeRefreshManager({ repository });

    const partialExecutor: IKnowledgeUpdateExecutor = {
      executePlan: async () => ({
        appliedAreas: ['FEATURE_MAPPING'],
        failedAreas: ['FEATURE_HEALTH'],
        skippedAreas: [],
        errors: ['Health check service unavailable'],
        warnings: [],
      }),
    };

    const processor = new KnowledgeUpdateProcessor({
      repository,
      executor: partialExecutor,
      versionManager,
      invalidationManager,
      refreshManager,
    });

    const update: KnowledgeUpdate = {
      updateId: 'upd-partial',
      repositoryId: 'repo-1',
      source: 'MANUAL',
      provenance: 'MANUALLY_CONFIRMED',
      updateType: 'FEATURE_MAPPING_CHANGED',
      status: 'RECEIVED',
      affectedResources: ['src/auth/service.ts'],
      affectedFeatures: ['feat-auth'],
      affectedKnowledgeAreas: ['FEATURE_MAPPING', 'FEATURE_HEALTH'],
      evidenceReferences: [],
      requestedAt: Date.now(),
      observedAt: Date.now(),
      idempotencyKey: 'k-partial',
      confidence: 1.0,
      retryCount: 0,
      metadata: {},
    };

    const plan: KnowledgeUpdatePlan = {
      planId: 'plan-partial',
      updateId: 'upd-partial',
      targetResources: ['src/auth/service.ts'],
      targetFeatures: ['feat-auth'],
      targetKnowledgeAreas: ['FEATURE_MAPPING', 'FEATURE_HEALTH'],
      operations: [],
      invalidationTargets: ['feat-auth'],
      refreshTargets: [],
      confidence: 1.0,
      warnings: [],
      conflicts: [],
      skippedAreas: [],
      reasonCodes: [],
      createdAt: Date.now(),
    };

    const result = await processor.process(update, plan);

    expect(result.status).toBe('PARTIALLY_APPLIED');
    expect(result.success).toBe(false);
    expect(result.partialSuccess).toBe(true);
    expect(result.appliedAreas).toContain('FEATURE_MAPPING');

    // Stored status should be PARTIALLY_APPLIED
    const stored = await repository.getUpdate('upd-partial');
    expect(stored?.status).toBe('PARTIALLY_APPLIED');
  });

  it('records FAILED status when all areas fail execution', async () => {
    const repository = new InMemoryKnowledgeUpdateRepository();
    const versionManager = new KnowledgeVersionManager(repository);
    const invalidationManager = new KnowledgeInvalidationManager(repository);
    const refreshManager = new KnowledgeRefreshManager({ repository });

    const failingExecutor: IKnowledgeUpdateExecutor = {
      executePlan: async () => ({
        appliedAreas: [],
        failedAreas: ['FEATURE_MAPPING', 'FEATURE_HEALTH'],
        skippedAreas: [],
        errors: ['Database locked'],
        warnings: [],
      }),
    };

    const processor = new KnowledgeUpdateProcessor({
      repository,
      executor: failingExecutor,
      versionManager,
      invalidationManager,
      refreshManager,
    });

    const update: KnowledgeUpdate = {
      updateId: 'upd-failed',
      repositoryId: 'repo-1',
      source: 'MANUAL',
      provenance: 'MANUALLY_CONFIRMED',
      updateType: 'FEATURE_MAPPING_CHANGED',
      status: 'RECEIVED',
      affectedResources: ['src/auth/service.ts'],
      affectedFeatures: ['feat-auth'],
      affectedKnowledgeAreas: ['FEATURE_MAPPING', 'FEATURE_HEALTH'],
      evidenceReferences: [],
      requestedAt: Date.now(),
      observedAt: Date.now(),
      idempotencyKey: 'k-failed',
      confidence: 1.0,
      retryCount: 0,
      metadata: {},
    };

    const plan: KnowledgeUpdatePlan = {
      planId: 'plan-failed',
      updateId: 'upd-failed',
      targetResources: ['src/auth/service.ts'],
      targetFeatures: ['feat-auth'],
      targetKnowledgeAreas: ['FEATURE_MAPPING'],
      operations: [],
      invalidationTargets: ['feat-auth'],
      refreshTargets: [],
      confidence: 1.0,
      warnings: [],
      conflicts: [],
      skippedAreas: [],
      reasonCodes: [],
      createdAt: Date.now(),
    };

    const result = await processor.process(update, plan);

    expect(result.status).toBe('FAILED');
    expect(result.success).toBe(false);
    expect(result.partialSuccess).toBe(false);

    const stored = await repository.getUpdate('upd-failed');
    expect(stored?.status).toBe('FAILED');
  });
});
