import { describe, it, expect, beforeEach } from 'vitest';
import { HybridRetrievalEngine } from '../../src/retrieval/engine/HybridRetrievalEngine.js';
import { SemanticIndex } from '../../src/retrieval/index/SemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../../src/retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import { InMemoryProjectMemoryStore } from '../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { HybridRetrievalRanker } from '../../src/retrieval/ranking/HybridRetrievalRanker.js';
import type { IFeatureRepository } from '../../src/knowledge/features/interfaces/IFeatureRepository.js';
import type { SemanticQuery } from '../../src/retrieval/models/SemanticQuery.js';

describe('Phase 9.4 - Hybrid Retrieval & Transparent Ranking (Section 43 Scenarios)', () => {
  let embeddingProvider: LocalSemanticEmbeddingProvider;
  let semanticIndex: SemanticIndex;
  let memoryStore: InMemoryProjectMemoryStore;
  let featureRepository: IFeatureRepository;
  let engine: HybridRetrievalEngine;

  beforeEach(async () => {
    embeddingProvider = new LocalSemanticEmbeddingProvider(128, '1.0.0');
    semanticIndex = new SemanticIndex();
    memoryStore = new InMemoryProjectMemoryStore();

    // Mock Feature Repository with deterministic data
    featureRepository = {
      async findByName(name: string) {
        const lower = name.toLowerCase();
        if (lower.includes('auth') || lower.includes('login')) {
          return [
            {
              id: 'feat_auth_001',
              featureId: 'feat_auth_001',
              name: 'Authentication Service',
              description: 'Handles user authentication, JWT tokens, and OAuth.',
              type: 'SERVICE' as any,
              status: 'ACTIVE' as any,
              origin: 'MANUAL' as any,
              confidence: { score: 0.95 } as any,
              scope: {} as any,
              metadata: { tags: ['auth', 'login', 'security'] },
              references: [],
              relationships: [],
              version: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ];
        }
        return [];
      },
      async list() {
        return [];
      },
      async get() {
        return null;
      },
      async create() {},
      async update() {},
      async delete() {
        return true;
      },
      async exists() {
        return true;
      },
      async findByReference() {
        return [];
      },
      async findByType() {
        return [];
      },
      async findByStatus() {
        return [];
      },
    };

    // Pre-populate Project Memory
    await memoryStore.save({
      memoryId: 'mem_session_decision',
      workspaceId: 'ws_mind',
      projectId: 'proj_auth',
      repositoryId: 'repo_mind',
      type: 'DECISION',
      title: 'Session Migration from Redis to PostgreSQL',
      content: 'Authentication sessions were migrated away from Redis to PostgreSQL store for persistence.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 0.95,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
      validFrom: Date.now() - 10000,
      version: 2,
      evidence: ['ADR-042', 'Commit #4f8a12'],
      relatedResources: ['src/auth/SessionStore.ts'],
      relatedFeatures: ['feat_auth_001'],
      relatedTasks: ['task_migration_sessions'],
    });

    // Pre-populate Semantic Index with code symbols
    const authEmb = await embeddingProvider.embedText('AuthService user login password verify and jwt token');
    await semanticIndex.index({
      resourceId: 'src/auth/AuthService.ts',
      resourceType: 'FILE',
      workspaceId: 'ws_mind',
      projectId: 'proj_auth',
      repositoryId: 'repo_mind',
      title: 'AuthService.login',
      contentReference: 'src/auth/AuthService.ts#L45-L80',
      snippet: 'export async function login(creds: Credentials): Promise<Token> { ... }',
      embedding: authEmb,
      embeddingVersion: '1.0.0',
      sourceVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Populate conflicting older documentation in semantic index
    const staleDocEmb = await embeddingProvider.embedText('Session cache Redis connection timeout details');
    await semanticIndex.index({
      resourceId: 'src/auth/SessionStore.ts',
      resourceType: 'DOCUMENTATION',
      workspaceId: 'ws_mind',
      projectId: 'proj_auth',
      repositoryId: 'repo_mind',
      title: 'Session Cache Redis Documentation',
      contentReference: 'docs/auth/redis_sessions.md',
      snippet: 'Authentication uses Redis connection pools for session caching and token revocation.',
      embedding: staleDocEmb,
      embeddingVersion: '1.0.0',
      sourceVersion: 1,
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
    });

    engine = new HybridRetrievalEngine(
      semanticIndex,
      embeddingProvider,
      memoryStore,
      undefined,
      featureRepository,
      new HybridRetrievalRanker()
    );
  });

  const baseQuery: SemanticQuery = {
    queryId: 'q_test_1',
    workspaceId: 'ws_mind',
    projectId: 'proj_auth',
    repositoryId: 'repo_mind',
    text: '',
    queryType: 'UNKNOWN',
    timestamp: Date.now(),
  };

  it('Scenario 1: Exact keyword query retrieves direct feature and symbol', async () => {
    const results = await engine.retrieve({
      ...baseQuery,
      text: 'Authentication Service',
      queryType: 'FEATURE',
    });

    expect(results.length).toBeGreaterThan(0);
    const top = results[0]!;
    expect(top.resourceId).toBe('feat_auth_001');
    expect(top.source).toBe('FEATURE_KNOWLEDGE');
    expect(top.score).toBeGreaterThanOrEqual(0.70);
  });

  it('Scenario 2: Semantic query retrieves conceptually related code without exact keywords', async () => {
    const results = await engine.retrieve({
      ...baseQuery,
      text: 'how credentials are checked to issue access tokens',
      queryType: 'CODE',
    });

    const authFile = results.find((r) => r.resourceId === 'src/auth/AuthService.ts');
    expect(authFile).toBeDefined();
    expect(authFile!.source).toBe('SEMANTIC_INDEX');
    expect(authFile!.dimensions.semanticRelevance).toBeGreaterThan(0.20);
  });

  it('Scenario 3: Feature query resolves authoritative feature definitions', async () => {
    const results = await engine.retrieve({
      ...baseQuery,
      text: 'auth',
      queryType: 'FEATURE',
    });

    expect(results.some((r) => r.source === 'FEATURE_KNOWLEDGE')).toBe(true);
  });

  it('Scenario 6: Memory query retrieves verified architectural decision', async () => {
    const results = await engine.retrieve({
      ...baseQuery,
      text: 'Session Migration from Redis to PostgreSQL',
      queryType: 'PROJECT_MEMORY',
    });

    const memoryResult = results.find((r) => r.source === 'PROJECT_MEMORY');
    expect(memoryResult).toBeDefined();
    expect(memoryResult!.name).toContain('Session Migration');
    expect(memoryResult!.authority).toBe('VERIFIED_PROJECT_DECISIONS');
  });

  it('Scenario 8: Conflicting knowledge detects contradiction and prioritizes authoritative fact', async () => {
    const results = await engine.retrieve({
      ...baseQuery,
      text: 'Session Redis cache',
      queryType: 'DEBUGGING',
    });

    // Check that conflict was detected on SessionStore
    const sessionMemory = results.find((r) => r.resourceId === 'src/auth/SessionStore.ts' || r.resourceId === 'mem_session_decision');
    expect(sessionMemory).toBeDefined();

    // The authoritative project decision ("migrated away from Redis to PostgreSQL") MUST rank higher
    // than the lower-authority semantic documentation claim ("Authentication uses Redis")
    const memoryIdx = results.findIndex((r) => r.source === 'PROJECT_MEMORY');
    const semanticIdx = results.findIndex((r) => r.source === 'SEMANTIC_INDEX' && r.resourceId === 'src/auth/SessionStore.ts');

    expect(memoryIdx).toBeLessThan(semanticIdx);
    expect(results[memoryIdx]!.conflicts?.length).toBeGreaterThan(0);
    expect(results[memoryIdx]!.conflicts![0]!.resolution).toContain('precedence');
  });

  it('Scenario 9: Invalidation reflects stale status', async () => {
    await semanticIndex.invalidate('src/auth/AuthService.ts', 'repo_mind');
    const entry = await semanticIndex.getEntry('src/auth/AuthService.ts', 'repo_mind');
    expect(entry?.metadata?.['isStale']).toBe(true);
  });

  it('Scenario 11: Scope isolation strictly excludes foreign projects', async () => {
    const results = await engine.retrieve({
      ...baseQuery,
      projectId: 'proj_foreign_unauthorized',
      text: 'Authentication Service',
    });

    // Cross-project mismatch drops candidate scopeRelevance to 0
    expect(results.every((r) => r.score === 0.0 || r.dimensions.scopeRelevance === 1.0)).toBe(true);
  });

  it('Scenario 12: Empty query returns empty results cleanly', async () => {
    const results = await engine.retrieve({
      ...baseQuery,
      text: 'completely_nonexistent_gibberish_xyz_9999',
    });

    expect(results.length).toBe(0);
  });
});
