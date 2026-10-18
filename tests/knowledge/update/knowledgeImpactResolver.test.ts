import { describe, it, expect, vi } from 'vitest';
import { KnowledgeImpactResolver } from '../../../src/knowledge/update/core/KnowledgeImpactResolver.js';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';

describe('KnowledgeImpactResolver', () => {
  const normalizer = new KnowledgeUpdateNormalizer();

  it('resolves resource to mapped features and propagates to downstream dependents', async () => {
    const mockMappingEngine = {
      getResourceFeatures: vi.fn().mockResolvedValue(['feat-auth']),
    };

    const mockDependencyEngine = {
      getDependents: vi.fn().mockImplementation((featId: string) => {
        if (featId === 'feat-auth') {
          return Promise.resolve([{ id: 'feat-session', name: 'Session Management' }]);
        }
        return Promise.resolve([]);
      }),
    };

    const resolver = new KnowledgeImpactResolver({
      mappingEngine: mockMappingEngine as any,
      dependencyEngine: mockDependencyEngine as any,
    });

    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src/auth/AuthService.ts'],
    });

    const impact = await resolver.resolveImpact(update);

    expect(impact.directlyAffectedFeatures).toContain('feat-auth');
    expect(impact.downstreamAffectedFeatures).toContain('feat-session');
    expect(impact.affectedKnowledgeAreas).toContain('FEATURE_MAPPING');
    expect(impact.affectedKnowledgeAreas).toContain('FEATURE_HEALTH');
    expect(impact.dependencyPaths).toContainEqual(['feat-auth', 'feat-session']);
  });

  it('aggregates blast radius across multiple updates', async () => {
    const mockMappingEngine = {
      getResourceFeatures: vi.fn().mockImplementation((res: string) => {
        if (res.includes('auth')) return Promise.resolve(['feat-auth']);
        if (res.includes('user')) return Promise.resolve(['feat-user']);
        return Promise.resolve([]);
      }),
    };

    const resolver = new KnowledgeImpactResolver({
      mappingEngine: mockMappingEngine as any,
    });

    const u1 = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src/auth/token.ts'],
    });

    const u2 = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src/user/profile.ts'],
    });

    const batchImpact = await resolver.resolveBatchImpact([u1, u2]);
    expect(batchImpact.directlyAffectedFeatures).toContain('feat-auth');
    expect(batchImpact.directlyAffectedFeatures).toContain('feat-user');
  });
});
