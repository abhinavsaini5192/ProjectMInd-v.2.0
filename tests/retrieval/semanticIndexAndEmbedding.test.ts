import { describe, it, expect } from 'vitest';
import { LocalSemanticEmbeddingProvider } from '../../src/retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import { SemanticIndex } from '../../src/retrieval/index/SemanticIndex.js';
import { SemanticChunker } from '../../src/retrieval/index/SemanticChunker.js';

describe('Phase 9.4 - Semantic Embedding & Indexing Subsystem', () => {
  describe('LocalSemanticEmbeddingProvider', () => {
    const provider = new LocalSemanticEmbeddingProvider(384, '1.0.0');

    it('generates unit-normalized vectors with correct dimension', async () => {
      const vec = await provider.embedText('Authentication and token verification service');
      expect(vec.length).toBe(384);

      // Verify L2 norm is ~1.0
      let sumSq = 0;
      for (const val of vec) sumSq += val * val;
      expect(Math.abs(Math.sqrt(sumSq) - 1.0)).toBeLessThan(0.01);
    });

    it('calculates deterministic high cosine similarity for semantically related texts', async () => {
      const vec1 = await provider.embedText('user login authentication and session handling');
      const vec2 = await provider.embedText('user authentication login and sessions');
      const vecUnrelated = await provider.embedText('invoice calculation pdf generation billing');

      const simRelated = LocalSemanticEmbeddingProvider.cosineSimilarity(vec1, vec2);
      const simUnrelated = LocalSemanticEmbeddingProvider.cosineSimilarity(vec1, vecUnrelated);

      expect(simRelated).toBeGreaterThan(0.60);
      expect(simUnrelated).toBeLessThan(0.40);
      expect(simRelated).toBeGreaterThan(simUnrelated);
    });

    it('maintains explicit provider and version metadata', () => {
      expect(provider.metadata.modelIdentifier).toBe('projectmind-local-semantic-v1');
      expect(provider.metadata.version).toBe('1.0.0');
      expect(provider.metadata.dimension).toBe(384);
      expect(provider.metadata.providerName).toBe('LOCAL_DETERMINISTIC');
      expect(provider.metadata.isNeural).toBe(false);
      expect(provider.metadata.algorithm).toContain('FNV-1a');
    });
  });

  describe('SemanticIndex', () => {
    const provider = new LocalSemanticEmbeddingProvider(64, '1.0.0');
    const index = new SemanticIndex();

    it('indexes and searches entries using cosine similarity and scope filtering', async () => {
      const embAuth = await provider.embedText('OAuth login and token verification');
      const embBilling = await provider.embedText('Credit card billing transaction invoice');

      await index.index({
        resourceId: 'src/auth/AuthService.ts',
        resourceType: 'FILE',
        workspaceId: 'ws_prod',
        projectId: 'proj_auth',
        repositoryId: 'repo_backend',
        title: 'AuthService',
        snippet: 'export class AuthService { login() {} }',
        embedding: embAuth,
        embeddingVersion: '1.0.0',
        sourceVersion: 'v1.2.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await index.index({
        resourceId: 'src/billing/BillingService.ts',
        resourceType: 'FILE',
        workspaceId: 'ws_prod',
        projectId: 'proj_billing',
        repositoryId: 'repo_backend',
        title: 'BillingService',
        snippet: 'export class BillingService { processPayment() {} }',
        embedding: embBilling,
        embeddingVersion: '1.0.0',
        sourceVersion: 'v1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Query for login/auth
      const queryVec = await provider.embedText('user login authentication');
      const matches = await index.search(queryVec, {
        workspaceId: 'ws_prod',
        repositoryId: 'repo_backend',
        minScore: 0.2,
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.entry.resourceId).toBe('src/auth/AuthService.ts');
      expect(matches[0]!.similarityScore).toBeGreaterThan(0.4);

      // Verify project scope containment
      const authProjMatches = await index.search(queryVec, {
        workspaceId: 'ws_prod',
        projectId: 'proj_auth',
        repositoryId: 'repo_backend',
      });
      expect(authProjMatches.every((m) => m.entry.projectId === 'proj_auth')).toBe(true);
    });

    it('invalidates entries and tracks staleness without dropping content reference', async () => {
      await index.invalidate('src/auth/AuthService.ts', 'repo_backend');
      const entry = await index.getEntry('src/auth/AuthService.ts', 'repo_backend');

      expect(entry).toBeDefined();
      expect(entry!.metadata?.['isStale']).toBe(true);
      expect(entry!.metadata?.['invalidatedAt']).toBeDefined();
    });

    it('removes entries cleanly and increments index version', async () => {
      const vBefore = index.getVersion();
      await index.remove('src/billing/BillingService.ts', 'repo_backend');
      const entry = await index.getEntry('src/billing/BillingService.ts', 'repo_backend');

      expect(entry).toBeUndefined();
      expect(index.getVersion()).toBeGreaterThan(vBefore);
    });
  });

  describe('SemanticChunker', () => {
    it('splits source code along semantic boundaries (functions, classes)', () => {
      const source = `
import { Session } from './session';

export class TokenManager {
  public generateToken(userId: string): string {
    return 'token_' + userId;
  }
}

export function verifyCredentials(creds: any): boolean {
  return creds.valid === true;
}
      `.trim();

      const chunks = SemanticChunker.chunkSourceFile('src/auth/tokens.ts', source, 'v2');
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      const tokenClassChunk = chunks.find((c) => c.symbolName === 'TokenManager');
      expect(tokenClassChunk).toBeDefined();
      expect(tokenClassChunk!.resourceType).toBe('SYMBOL');
      expect(tokenClassChunk!.content).toContain('class TokenManager');
      expect(tokenClassChunk!.sourceVersion).toBe('v2');

      const verifyFuncChunk = chunks.find((c) => c.symbolName === 'verifyCredentials');
      expect(verifyFuncChunk).toBeDefined();
      expect(verifyFuncChunk!.content).toContain('function verifyCredentials');
    });
  });
});
