import { describe, it, expect } from 'vitest';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';

describe('KnowledgeUpdateNormalizer', () => {
  const normalizer = new KnowledgeUpdateNormalizer();

  it('normalizes file paths to POSIX format and trims identifiers', () => {
    const update = normalizer.normalize({
      repositoryId: ' repo-1 ',
      workspaceId: ' ws-1 ',
      source: 'MANUAL',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src\\auth\\AuthService.ts', '/src/user/User.ts/'],
      affectedFeatures: [' feat-auth ', 'feat-user'],
    });

    expect(update.repositoryId).toBe('repo-1');
    expect(update.workspaceId).toBe('ws-1');
    expect(update.affectedResources).toEqual(['src/auth/AuthService.ts', 'src/user/User.ts']);
    expect(update.affectedFeatures).toEqual(['feat-auth', 'feat-user']);
    expect(update.status).toBe('RECEIVED');
    expect(update.updateId).toBeDefined();
    expect(update.idempotencyKey).toBeDefined();
  });

  it('infers default provenance and knowledge areas based on update type', () => {
    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'VERIFICATION_EVIDENCE',
      updateType: 'VERIFICATION_CHANGED',
    });

    expect(update.provenance).toBe('SYSTEM_VERIFIED');
    expect(update.affectedKnowledgeAreas).toContain('VERIFICATION');
    expect(update.affectedKnowledgeAreas).toContain('FEATURE_HEALTH');
  });

  it('computes deterministic idempotency key for identical inputs', () => {
    const key1 = normalizer.normalize({
      repositoryId: 'repo-1',
      sourceEventId: 'evt-100',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
    }).idempotencyKey;

    const key2 = normalizer.normalize({
      repositoryId: 'repo-1',
      sourceEventId: 'evt-100',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
    }).idempotencyKey;

    expect(key1).toBe(key2);
  });
});
