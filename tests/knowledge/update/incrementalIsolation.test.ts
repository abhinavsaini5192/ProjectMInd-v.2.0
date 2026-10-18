import { describe, it, expect, vi } from 'vitest';
import { KnowledgeUpdateCoordinator } from '../../../src/knowledge/update/core/KnowledgeUpdateCoordinator.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';
import { KnowledgeUpdateDeduplicator } from '../../../src/knowledge/update/core/KnowledgeUpdateDeduplicator.js';
import { KnowledgeUpdateValidator } from '../../../src/knowledge/update/core/KnowledgeUpdateValidator.js';
import { KnowledgeImpactResolver } from '../../../src/knowledge/update/core/KnowledgeImpactResolver.js';
import { KnowledgeUpdatePlanner } from '../../../src/knowledge/update/core/KnowledgeUpdatePlanner.js';
import { KnowledgeUpdateExecutor } from '../../../src/knowledge/update/core/KnowledgeUpdateExecutor.js';
import { KnowledgeVersionManager } from '../../../src/knowledge/update/core/KnowledgeVersionManager.js';
import { KnowledgeInvalidationManager } from '../../../src/knowledge/update/core/KnowledgeInvalidationManager.js';
import { KnowledgeRefreshManager } from '../../../src/knowledge/update/core/KnowledgeRefreshManager.js';
import { KnowledgeUpdateProcessor } from '../../../src/knowledge/update/core/KnowledgeUpdateProcessor.js';
import { KnowledgeUpdateRunManager } from '../../../src/knowledge/update/core/KnowledgeUpdateRunManager.js';
import { KnowledgeUpdateExplainer } from '../../../src/knowledge/update/core/KnowledgeUpdateExplainer.js';
import type { IFeatureMappingEngine } from '../../../src/knowledge/features/mapping/interfaces/IFeatureMappingEngine.js';
import type { IFeatureDependencyEngine } from '../../../src/knowledge/features/dependencies/interfaces/IFeatureDependencyEngine.js';
import type { IFeatureHealthEngine } from '../../../src/knowledge/features/health/interfaces/IFeatureHealthEngine.js';
import type { IFeatureHistoryEngine } from '../../../src/knowledge/features/history/interfaces/IFeatureHistoryEngine.js';
import type { IAgentContextSessionManager } from '../../../src/agent/context/interfaces/IAgentContextSessionManager.js';

describe('Incremental Isolation (Sections 57 & 58)', () => {
  it('modifying AuthService.login() updates ONLY feat-auth and leaves Payment/Catalog untouched', async () => {
    const repository = new InMemoryKnowledgeUpdateRepository();
    const normalizer = new KnowledgeUpdateNormalizer();
    const deduplicator = new KnowledgeUpdateDeduplicator(repository);
    const validator = new KnowledgeUpdateValidator();
    const versionManager = new KnowledgeVersionManager(repository);
    const invalidationManager = new KnowledgeInvalidationManager(repository);
    const explainer = new KnowledgeUpdateExplainer();

    const mockContextSessionManager: IAgentContextSessionManager = {
      markContextStale: vi.fn().mockResolvedValue(undefined),
    } as any;

    const refreshManager = new KnowledgeRefreshManager({
      repository,
      contextSessionManager: mockContextSessionManager,
    });

    // Mock Feature Intelligence engines tracking calls
    const featureMappingCalls: string[] = [];
    const featureHealthCalls: string[] = [];
    const featureHistoryCalls: string[] = [];

    const mockMappingEngine: IFeatureMappingEngine = {
      getResourceFeatures: vi.fn(async (path: string) => {
        if (path.includes('AuthService.ts')) {
          return ['feat-auth'];
        }
        if (path.includes('PaymentService.ts')) {
          return ['feat-payment'];
        }
        return [];
      }),
      mapIncremental: vi.fn(async (resources: string[]) => {
        for (const res of resources) {
          if (res.includes('AuthService.ts')) featureMappingCalls.push('feat-auth');
          if (res.includes('PaymentService.ts')) featureMappingCalls.push('feat-payment');
        }
      }),
    } as any;

    const mockDependencyEngine: IFeatureDependencyEngine = {
      getDependents: vi.fn().mockResolvedValue([]),
    } as any;

    const mockHealthEngine: IFeatureHealthEngine = {
      analyzeIncremental: vi.fn(async (featureIds: string[]) => {
        featureHealthCalls.push(...featureIds);
      }),
    } as any;

    const mockHistoryEngine: IFeatureHistoryEngine = {
      updateIncremental: vi.fn(async (events: any[]) => {
        for (const ev of events) {
          featureHistoryCalls.push(ev.featureId);
        }
      }),
    } as any;

    const impactResolver = new KnowledgeImpactResolver({
      mappingEngine: mockMappingEngine,
      dependencyEngine: mockDependencyEngine,
    });

    const planner = new KnowledgeUpdatePlanner(impactResolver);

    const executor = new KnowledgeUpdateExecutor({
      mappingEngine: mockMappingEngine,
      dependencyEngine: mockDependencyEngine,
      healthEngine: mockHealthEngine,
      historyEngine: mockHistoryEngine,
    });

    const processor = new KnowledgeUpdateProcessor({
      repository,
      executor,
      versionManager,
      invalidationManager,
      refreshManager,
    });

    const runManager = new KnowledgeUpdateRunManager(repository);

    const coordinator = new KnowledgeUpdateCoordinator({
      repository,
      normalizer,
      deduplicator,
      validator,
      planner,
      processor,
      versionManager,
      runManager,
      explainer,
    });

    // An agent modifies AuthService.ts
    const result = await coordinator.processKnowledgeUpdate({
      repositoryId: 'repo-mind',
      source: 'EXECUTION_OBSERVATION',
      provenance: 'SYSTEM_OBSERVED',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src/auth/AuthService.ts'],
      agentSessionId: 'sess-auth-agent',
      metadata: { changeDescription: 'Updated login validation' },
    });

    expect(result.status).toBe('APPLIED');
    expect(result.success).toBe(true);

    // Affected features must ONLY be feat-auth
    expect(result.affectedFeatures).toEqual(['feat-auth']);
    expect(result.affectedFeatures).not.toContain('feat-payment');

    // Engine invocations must be targeted only to feat-auth
    expect(featureMappingCalls).toContain('feat-auth');
    expect(featureMappingCalls).not.toContain('feat-payment');

    expect(featureHealthCalls).toContain('feat-auth');
    expect(featureHealthCalls).not.toContain('feat-payment');

    expect(featureHistoryCalls).toContain('feat-auth');
    expect(featureHistoryCalls).not.toContain('feat-payment');

    // Invalidation targets should only include feat-auth and AuthService.ts
    const invalidatedTargets = result.invalidations.map((i) => i.targetId);
    expect(invalidatedTargets).toContain('feat-auth');
    expect(invalidatedTargets).toContain('src/auth/AuthService.ts');
    expect(invalidatedTargets).not.toContain('feat-payment');
    expect(invalidatedTargets).not.toContain('src/payment/PaymentService.ts');

    // Context session stale marking called for the active agent session
    expect(mockContextSessionManager.markContextStale).toHaveBeenCalledWith(
      'sess-auth-agent',
      'FEATURE_CHANGED'
    );
  });
});
