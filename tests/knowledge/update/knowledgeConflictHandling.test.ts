import { describe, it, expect } from 'vitest';
import { KnowledgeUpdateProcessor } from '../../../src/knowledge/update/core/KnowledgeUpdateProcessor.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';
import { KnowledgeVersionManager } from '../../../src/knowledge/update/core/KnowledgeVersionManager.js';
import { KnowledgeInvalidationManager } from '../../../src/knowledge/update/core/KnowledgeInvalidationManager.js';
import { KnowledgeRefreshManager } from '../../../src/knowledge/update/core/KnowledgeRefreshManager.js';
import type { IKnowledgeUpdateExecutor } from '../../../src/knowledge/update/interfaces/IKnowledgeUpdateProcessor.js';
import type { KnowledgeUpdate } from '../../../src/knowledge/update/models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../../../src/knowledge/update/models/KnowledgeUpdatePlan.js';

describe('Knowledge Conflict Handling', () => {
  it('detects verification conflict and resolves in favor of verification precedence', async () => {
    const repository = new InMemoryKnowledgeUpdateRepository();
    const versionManager = new KnowledgeVersionManager(repository);
    const invalidationManager = new KnowledgeInvalidationManager(repository);
    const refreshManager = new KnowledgeRefreshManager({ repository });

    const mockExecutor: IKnowledgeUpdateExecutor = {
      executePlan: async () => ({
        appliedAreas: ['FEATURE_HEALTH', 'VERIFICATION'],
        failedAreas: [],
        skippedAreas: [],
        errors: [],
        warnings: [],
      }),
    };

    const processor = new KnowledgeUpdateProcessor({
      repository,
      executor: mockExecutor,
      versionManager,
      invalidationManager,
      refreshManager,
    });

    const update: KnowledgeUpdate = {
      updateId: 'upd-conflicted',
      repositoryId: 'repo-1',
      source: 'AGENT_REPORTED' as any,
      provenance: 'AGENT_REPORTED',
      updateType: 'VERIFICATION_CHANGED',
      status: 'RECEIVED',
      affectedResources: ['src/auth/service.ts'],
      affectedFeatures: ['feat-auth'],
      affectedKnowledgeAreas: ['VERIFICATION', 'FEATURE_HEALTH'],
      evidenceReferences: [{ referenceId: 'ref-1', referenceType: 'VERIFICATION' }],
      requestedAt: Date.now(),
      observedAt: Date.now(),
      idempotencyKey: 'k-conflicted',
      confidence: 0.9,
      retryCount: 0,
      metadata: { verificationStatus: 'FAILED' },
    };

    const plan: KnowledgeUpdatePlan = {
      planId: 'plan-conflicted',
      updateId: 'upd-conflicted',
      targetResources: ['src/auth/service.ts'],
      targetFeatures: ['feat-auth'],
      targetKnowledgeAreas: ['VERIFICATION', 'FEATURE_HEALTH'],
      operations: [],
      invalidationTargets: ['feat-auth'],
      refreshTargets: [],
      confidence: 0.9,
      warnings: [],
      conflicts: [],
      skippedAreas: [],
      reasonCodes: [],
      createdAt: Date.now(),
    };

    const result = await processor.process(update, plan);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.conflictType).toBe('VERIFICATION_CONFLICT');
    expect(result.conflicts[0]!.resolutionStatus).toBe('RESOLVED_PRECEDENCE');
    expect(result.conflicts[0]!.resolutionRationale).toContain('Verification failure takes precedence');

    const storedConflicts = await repository.getConflictsByUpdate('upd-conflicted');
    expect(storedConflicts).toHaveLength(1);
  });
});
