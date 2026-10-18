import { describe, it, expect } from 'vitest';
import { KnowledgeVersionManager } from '../../../src/knowledge/update/core/KnowledgeVersionManager.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';

describe('KnowledgeVersionManager', () => {
  it('increments version from K1 to K2 with parent linkage', async () => {
    const repo = new InMemoryKnowledgeUpdateRepository();
    const versionManager = new KnowledgeVersionManager(repo);

    const v1 = await versionManager.createNextVersion({
      repositoryId: 'repo-1',
      sourceUpdateIds: ['u-1'],
      affectedAreas: ['FEATURE_MAPPING'],
      affectedResources: ['src/auth/token.ts'],
      affectedFeatures: ['feat-auth'],
    });

    expect(v1.versionId).toBe('K1');
    expect(v1.versionNumber).toBe(1);
    expect(v1.parentVersionId).toBeUndefined();

    const v2 = await versionManager.createNextVersion({
      repositoryId: 'repo-1',
      sourceUpdateIds: ['u-2'],
      affectedAreas: ['FEATURE_HEALTH'],
      affectedResources: ['src/auth/token.ts'],
      affectedFeatures: ['feat-auth'],
    });

    expect(v2.versionId).toBe('K2');
    expect(v2.versionNumber).toBe(2);
    expect(v2.parentVersionId).toBe('K1');
  });

  it('evaluates whether an update warrants a version increment', () => {
    const repo = new InMemoryKnowledgeUpdateRepository();
    const versionManager = new KnowledgeVersionManager(repo);

    expect(
      versionManager.shouldIncrementVersion(['FEATURE_MAPPING'], ['src/auth.ts'], ['feat-auth'])
    ).toBe(true);

    expect(versionManager.shouldIncrementVersion([], ['src/auth.ts'], ['feat-auth'])).toBe(false);
    expect(versionManager.shouldIncrementVersion(['FEATURE_MAPPING'], [], [])).toBe(false);
  });
});
