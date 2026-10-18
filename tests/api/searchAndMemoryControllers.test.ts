import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { SearchController } from '../../src/api/controllers/SearchController.js';
import { MemoryController } from '../../src/api/controllers/MemoryController.js';
import { HybridRetrievalEngine } from '../../src/retrieval/engine/HybridRetrievalEngine.js';
import { SemanticIndex } from '../../src/retrieval/index/SemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../../src/retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import { InMemoryProjectMemoryStore } from '../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { ProjectMemoryManager } from '../../src/memory/project/services/ProjectMemoryManager.js';
import { ApiError } from '../../src/api/errors/ApiError.js';

describe('Search & Memory API Controllers Suite (Phase 9.4 Section 46)', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let memoryStore: InMemoryProjectMemoryStore;
  let memoryManager: ProjectMemoryManager;
  let semanticIndex: SemanticIndex;
  let embeddingProvider: LocalSemanticEmbeddingProvider;
  let retrievalEngine: HybridRetrievalEngine;
  let searchController: SearchController;
  let memoryController: MemoryController;

  beforeEach(async () => {
    router = new ApiRouter();
    requestService = new RequestService();

    memoryStore = new InMemoryProjectMemoryStore();
    memoryManager = new ProjectMemoryManager(memoryStore);
    semanticIndex = new SemanticIndex();
    embeddingProvider = new LocalSemanticEmbeddingProvider();

    retrievalEngine = new HybridRetrievalEngine(
      semanticIndex,
      embeddingProvider,
      memoryStore
    );

    searchController = new SearchController(retrievalEngine);
    memoryController = new MemoryController(memoryManager, memoryStore);

    searchController.registerRoutes(router);
    memoryController.registerRoutes(router);

    // Pre-populate index
    const emb = await embeddingProvider.embedText('AuthService token validation');
    await semanticIndex.index({
      resourceId: 'src/auth/AuthService.ts',
      resourceType: 'FILE',
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      repositoryId: 'repo_api',
      title: 'AuthService',
      contentReference: 'src/auth/AuthService.ts',
      snippet: 'export class AuthService {}',
      embedding: emb,
      embeddingVersion: '1.0.0',
      sourceVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Pre-populate memory
    await memoryManager.recordMemory({
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      repositoryId: 'repo_api',
      type: 'DECISION',
      title: 'PostgreSQL Session Storage',
      content: 'Sessions are stored in PostgreSQL rather than Redis.',
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'DEVELOPER',
      confidence: 1.0,
      authority: 'AUTHORITATIVE',
      status: 'ACTIVE',
      evidence: ['ADR-004'],
      relatedResources: ['src/auth/AuthService.ts'],
      relatedFeatures: ['feat_auth'],
      relatedTasks: [],
    });
  });

  describe('SearchController: POST /search', () => {
    it('executes hybrid search and returns 200 with ranked results', async () => {
      const req = requestService.createRequest({
        path: '/search',
        method: 'POST',
        body: {
          workspaceId: 'ws_alpha',
          projectId: 'proj_auth',
          repositoryId: 'repo_api',
          text: 'AuthService token validation',
          limit: 5,
        },
      });

      const response = await router.handle(req);
      expect(response.status).toBe(200);
      const data = response.data as any;
      expect(data.results).toBeDefined();
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results[0].dimensions).toBeDefined();
      expect(data.results[0].source).toBeDefined();
    });

    it('rejects empty query text with 400 validation error', async () => {
      const req = requestService.createRequest({
        path: '/search',
        method: 'POST',
        body: {
          workspaceId: 'ws_alpha',
          text: '',
        },
      });

      await expect(router.handle(req)).rejects.toThrow(ApiError);
    });

    it('enforces scope isolation against foreign project', async () => {
      const req = requestService.createRequest({
        path: '/search',
        method: 'POST',
        body: {
          workspaceId: 'ws_alpha',
          projectId: 'proj_foreign_unauthorized',
          text: 'AuthService',
        },
      });
      (req.context as any).security = {
        workspaceId: 'ws_alpha',
        projectId: 'proj_my_own_scope',
        isGlobalAdmin: () => false,
      };

      await expect(router.handle(req)).rejects.toThrow(ApiError);
    });
  });

  describe('MemoryController: /memory endpoints', () => {
    it('GET /memory lists active project memories within scope', async () => {
      const req = requestService.createRequest({
        path: '/memory',
        method: 'GET',
        query: {
          workspaceId: 'ws_alpha',
          projectId: 'proj_auth',
          repositoryId: 'repo_api',
        },
      });

      const response = await router.handle(req);
      expect(response.status).toBe(200);
      const data = response.data as any;
      expect(data.count).toBe(1);
      expect(data.memories[0].title).toBe('PostgreSQL Session Storage');
    });

    it('GET /memory/:id retrieves specific memory', async () => {
      const listReq = requestService.createRequest({
        path: '/memory',
        method: 'GET',
        query: { workspaceId: 'ws_alpha', projectId: 'proj_auth' },
      });
      const listResp = await router.handle(listReq);
      const memoryId = (listResp.data as any).memories[0].memoryId;

      const getReq = requestService.createRequest({
        path: `/memory/${memoryId}`,
        method: 'GET',
      });
      const getResp = await router.handle(getReq);
      expect(getResp.status).toBe(200);
      expect((getResp.data as any).memoryId).toBe(memoryId);
    });

    it('POST /memory/candidates proposes a candidate, lists it, and promotes it', async () => {
      const propReq = requestService.createRequest({
        path: '/memory/candidates',
        method: 'POST',
        body: {
          workspaceId: 'ws_alpha',
          projectId: 'proj_auth',
          repositoryId: 'repo_api',
          type: 'ARCHITECTURE',
          title: 'JWT Expiration Policy',
          content: 'Access tokens expire in 15 minutes, refresh tokens in 7 days.',
          source: 'ARCHITECTURAL_DECISION_RECORD',
          provenance: 'DEVELOPER',
          confidence: 1.0,
          evidence: ['SEC-100'],
          relatedResources: ['src/auth/jwt.ts'],
        },
      });

      const propResp = await router.handle(propReq);
      expect(propResp.status).toBe(201);
      const cand = propResp.data as any;
      expect(cand.candidateId).toBeDefined();

      // List candidates
      const listCandReq = requestService.createRequest({
        path: '/memory/candidates',
        method: 'GET',
        query: { repositoryId: 'repo_api', projectId: 'proj_auth' },
      });
      const listCandResp = await router.handle(listCandReq);
      expect((listCandResp.data as any).candidates.length).toBe(1);

      // Promote candidate
      const promReq = requestService.createRequest({
        path: `/memory/candidates/${cand.candidateId}/promote`,
        method: 'POST',
      });
      const promResp = await router.handle(promReq);
      expect(promResp.status).toBe(200);
      expect((promResp.data as any).title).toBe('JWT Expiration Policy');
      expect((promResp.data as any).status).toBe('ACTIVE');
    });

    it('GET /memory/:id returns 404 for nonexistent memory', async () => {
      const req = requestService.createRequest({
        path: '/memory/mem_nonexistent_xyz',
        method: 'GET',
      });

      await expect(router.handle(req)).rejects.toThrow(ApiError);
    });
  });
});
