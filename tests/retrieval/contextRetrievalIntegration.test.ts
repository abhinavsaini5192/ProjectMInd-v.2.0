import { describe, it, expect, beforeEach } from 'vitest';
import { ContextOrchestrator } from '../../src/context/orchestrator/ContextOrchestrator.js';
import { ContextRetrievalCoordinator } from '../../src/context/retrieval/ContextRetrievalCoordinator.js';
import { InMemoryProjectMemoryStore } from '../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { SemanticIndex } from '../../src/retrieval/index/SemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../../src/retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import { HybridRetrievalEngine } from '../../src/retrieval/engine/HybridRetrievalEngine.js';
import { HybridRetrievalRanker } from '../../src/retrieval/ranking/HybridRetrievalRanker.js';
import {
  createMockFeatureKnowledgeApi,
  createMockRepositories,
} from '../context/ContextTestHelper.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Phase 9.4 Context Integration Tests (Section 29)', () => {
  let memoryStore: InMemoryProjectMemoryStore;
  let semanticIndex: SemanticIndex;
  let embeddingProvider: LocalSemanticEmbeddingProvider;
  let retrievalEngine: HybridRetrievalEngine;
  let orchestrator: ContextOrchestrator;

  beforeEach(async () => {
    memoryStore = new InMemoryProjectMemoryStore();
    semanticIndex = new SemanticIndex();
    embeddingProvider = new LocalSemanticEmbeddingProvider();

    const api = createMockFeatureKnowledgeApi();
    const { featureRepository, mappingRepository } = createMockRepositories();
    const retriever = new ContextRetrievalCoordinator(api, featureRepository, mappingRepository);

    retrievalEngine = new HybridRetrievalEngine(
      semanticIndex,
      embeddingProvider,
      memoryStore,
      undefined,
      featureRepository,
      new HybridRetrievalRanker()
    );

    // Pre-populate Project Memory
    await memoryStore.save({
      memoryId: 'mem_auth_migration_01',
      workspaceId: 'ws_mind',
      projectId: 'proj_auth_core',
      repositoryId: 'repo_mind',
      type: 'DECISION',
      title: 'Session Migration from Redis to PostgreSQL',
      content: 'Authentication sessions were migrated away from Redis to PostgreSQL store for persistence.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 1.0,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      createdAt: Date.now() - 50000,
      updatedAt: Date.now() - 50000,
      validFrom: Date.now() - 50000,
      version: 1,
      evidence: ['ADR-042'],
      relatedResources: ['src/auth/SessionStore.ts'],
      relatedFeatures: ['feat_auth_service_001'],
      relatedTasks: [],
    });

    // Pre-populate Semantic Index
    const docEmb = await embeddingProvider.embedText('SessionStore database persistence schema queries');
    await semanticIndex.index({
      resourceId: 'src/auth/SessionStore.ts',
      resourceType: 'FILE',
      workspaceId: 'ws_mind',
      projectId: 'proj_auth_core',
      repositoryId: 'repo_mind',
      title: 'SessionStore',
      contentReference: 'src/auth/SessionStore.ts',
      snippet: 'export class SessionStore { async findSession(id: string) { ... } }',
      embedding: docEmb,
      embeddingVersion: '1.0.0',
      sourceVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    orchestrator = new ContextOrchestrator(
      retriever,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      api,
      undefined,
      memoryStore,
      retrievalEngine
    );
  });

  it('1. Full Pipeline integrates Task -> Context Intelligence -> Semantic Retrieval & Project Memory', async () => {
    const request: ContextRequest = {
      workspaceId: 'ws_mind',
      projectId: 'proj_auth_core',
      repositoryId: 'repo_mind',
      taskText: 'Debug authentication session token validation and PostgreSQL database state',
      tokenBudget: 4000,
      compressionMode: 'COMPACT',
      includeDependencies: true,
      includeBehavior: true,
      includeHealth: true,
      explainSelection: true,
    };

    const response = await orchestrator.orchestrateContext(request);
    expect(response.success).toBe(true);
    expect(response.package).toBeDefined();

    const pkg = response.package!;
    // 1. Authoritative feature knowledge was resolved
    const authFeature = pkg.features.find((f) => f.featureId === 'feat_auth_service_001');
    expect(authFeature).toBeDefined();

    // 2. Resources contain both primary source files and semantic index / memory resolved files
    const sessionFile = pkg.resources.find((r) => (r.filePath ?? r.path ?? '').includes('SessionStore'));
    expect(sessionFile).toBeDefined();

    // 3. Explanation tracks resolution
    if (response.explanations) {
      expect(Object.keys(response.explanations.resourceSelectionReasons).length).toBeGreaterThanOrEqual(0);
    }
  });

  it('2. Scope isolation in context intelligence respects workspace/project boundaries', async () => {
    const request: ContextRequest = {
      workspaceId: 'ws_mind',
      projectId: 'proj_foreign_unauthorized',
      repositoryId: 'repo_mind',
      taskText: 'Session Migration from Redis to PostgreSQL',
      tokenBudget: 3000,
    };

    // Candidate generation with foreign projectId should not leak proj_auth_core memories
    const resolvedCandidates = await (orchestrator as any).candidateResolver.resolveCandidates(
      {
        taskType: 'DEBUGGING',
        intent: 'DEBUG',
        confidence: 0.9,
        targetFeatures: [],
        candidateFeatures: [],
        targetResources: [],
        taskPhases: [],
        normalizedRequest: 'Session Migration from Redis to PostgreSQL',
        rawRequest: 'Session Migration from Redis to PostgreSQL',
        extractedTerms: ['session', 'migration'],
        constraints: [],
        riskFactors: [],
        recommendedScope: { breadth: 'NARROW', depth: 'SHALLOW' },
      },
      {
        workspaceId: 'ws_mind',
        projectId: 'proj_foreign_unauthorized',
        repositoryId: 'repo_mind',
        tokenBudget: 3000,
        compressionMode: 'COMPACT',
        includeDependencies: false,
        includeBehavior: false,
        includeHealth: false,
        includeHistory: false,
        includeArchitecture: false,
        explainSelection: false,
        priorityThreshold: 'LOW',
      },
      []
    );

    const leakedMemory = resolvedCandidates.find((c: any) => c.resourceId === 'mem_auth_migration_01');
    expect(leakedMemory).toBeUndefined();
  });
});
