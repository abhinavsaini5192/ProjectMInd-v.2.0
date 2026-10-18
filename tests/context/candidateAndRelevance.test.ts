import { describe, it, expect, beforeEach } from 'vitest';
import { ContextCandidateResolver } from '../../src/context/intelligence/ContextCandidateResolver.js';
import { ContextRelevanceEngine } from '../../src/context/intelligence/ContextRelevanceEngine.js';
import { ContextExpansionEngine } from '../../src/context/intelligence/ContextExpansionEngine.js';
import { ContextCompressionEngine } from '../../src/context/intelligence/ContextCompressionEngine.js';
import { createMockFeatureKnowledgeApi, AUTH_FEATURE_ID, CHECKOUT_FEATURE_ID } from './ContextTestHelper.js';
import type { TaskUnderstanding } from '../../src/context/models/TaskUnderstanding.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Phase 9.3 - Candidate Generation, Relevance & Progressive Expansion', () => {
  let resolver: ContextCandidateResolver;
  let relevanceEngine: ContextRelevanceEngine;
  let expansionEngine: ContextExpansionEngine;
  let compressionEngine: ContextCompressionEngine;

  const mockTask: TaskUnderstanding = {
    taskId: 'task_test_1',
    rawRequest: 'Fix login timeout issue in authentication service',
    normalizedRequest: 'Fix login timeout issue in authentication service',
    taskType: 'DEBUGGING',
    intent: 'DEBUG',
    targetEntities: ['AuthService.login'],
    candidateFeatures: [AUTH_FEATURE_ID, 'authentication'],
    candidateResources: ['src/auth/AuthService.ts'],
    requestedAction: 'Fix login timeout issue',
    constraints: [],
    scope: { workspaceId: 'ws_1', projectId: 'proj_1', repositoryId: 'repo_1' },
    confidence: 0.9,
    provenance: 'DETERMINISTIC_RULES',
  };

  const mockRequest: ContextRequest = {
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    repositoryId: 'repo_1',
    taskText: 'Fix login timeout issue in authentication service',
    featureIds: [AUTH_FEATURE_ID],
    changedResources: ['src/auth/AuthService.ts'],
    tokenBudget: 500,
  };

  beforeEach(() => {
    const api = createMockFeatureKnowledgeApi();
    resolver = new ContextCandidateResolver(api);
    relevanceEngine = new ContextRelevanceEngine();
    expansionEngine = new ContextExpansionEngine();
    compressionEngine = new ContextCompressionEngine();
  });

  describe('Candidate Generation & Multi-dimensional Relevance', () => {
    it('resolves candidates across features, files, dependencies, behavior, risks, and history', async () => {
      const candidates = await resolver.resolveCandidates(mockTask, mockRequest, [AUTH_FEATURE_ID]);
      expect(candidates.length).toBeGreaterThanOrEqual(4);

      expect(candidates.some((c) => c.candidateType === 'FEATURE')).toBe(true);
      expect(candidates.some((c) => c.candidateType === 'FILE')).toBe(true);
      expect(candidates.some((c) => c.candidateType === 'DEPENDENCY')).toBe(true);
      expect(candidates.some((c) => c.candidateType === 'BEHAVIOR_STEP')).toBe(true);
      expect(candidates.some((c) => c.candidateType === 'RISK')).toBe(true);
      expect(candidates.some((c) => c.candidateType === 'HISTORY_EVENT')).toBe(true);
    });

    it('calculates 12 relevance dimensions and assigns CRITICAL/HIGH priorities', async () => {
      const candidates = await resolver.resolveCandidates(mockTask, mockRequest, [AUTH_FEATURE_ID]);
      const scored = relevanceEngine.scoreCandidates(candidates, mockTask, mockRequest);

      const authFile = scored.find((c) => c.path?.includes('AuthService'));
      expect(authFile).toBeDefined();
      expect(authFile!.priority).toBe('CRITICAL');
      expect(authFile!.dimensions.taskRelevance).toBeGreaterThanOrEqual(0.7);
      expect(authFile!.dimensions.changeRelevance).toBe(1.0);
      expect(authFile!.primaryEvidence).toContain('Modified in working tree');
    });
  });

  describe('Controlled Progressive Expansion', () => {
    it('progressively expands candidates and tracks exclusions when budget is constrained', async () => {
      const candidates = await resolver.resolveCandidates(mockTask, mockRequest, [AUTH_FEATURE_ID]);
      const scored = relevanceEngine.scoreCandidates(candidates, mockTask, mockRequest);

      // Low budget of 250 tokens
      const expansion = expansionEngine.expand(scored, mockTask, 250, 0.25);

      expect(expansion.selectedCandidates.length).toBeGreaterThan(0);
      expect(expansion.totalTokens).toBeLessThanOrEqual(250);
      expect(expansion.exclusions.length).toBeGreaterThan(0);

      // Exclusions must carry stage and reason
      const budgetExclusion = expansion.exclusions.find((e) => e.stage === 'TOKEN_BUDGET');
      expect(budgetExclusion).toBeDefined();
      expect(budgetExclusion!.reason).toContain('exceed token budget');
    });

    it('excludes candidates falling below relevance threshold', () => {
      const lowRelevanceCandidate = {
        candidateId: 'cand_unrelated',
        candidateType: 'FILE' as const,
        name: 'unrelated/docs.md',
        score: 0.15,
        priority: 'OPTIONAL' as const,
        dimensions: {
          taskRelevance: 0.1,
          featureRelevance: 0.1,
          architecturalRelevance: 0.1,
          dependencyRelevance: 0.1,
          behavioralRelevance: 0.1,
          changeRelevance: 0.1,
          historyRelevance: 0.1,
          riskRelevance: 0.1,
          verificationRelevance: 0.1,
          recency: 0.1,
          confidence: 0.8,
          scopeRelevance: 1.0,
        },
        primaryEvidence: 'Unrelated candidate',
        estimatedTokens: 50,
      };

      const result = expansionEngine.expand([lowRelevanceCandidate], mockTask, 1000, 0.25);
      expect(result.selectedCandidates.length).toBe(0);
      expect(result.exclusions.some((e) => e.stage === 'RELEVANCE_THRESHOLD')).toBe(true);
    });
  });

  describe('Context Compression & Source Fragment Selection', () => {
    it('applies compression modes and extracts symbol source fragments', () => {
      const candidateWithSymbol = {
        candidateId: 'auth_login_sym',
        candidateType: 'FILE' as const,
        name: 'AuthService.login',
        path: 'src/auth/AuthService.ts',
        symbolSignature: 'AuthService.login(credentials: UserCredentials): Promise<SessionToken>',
        sourceFragment: 'export async function login(creds) {\n  return token;\n}',
        score: 0.95,
        priority: 'CRITICAL' as const,
        dimensions: {
          taskRelevance: 0.95,
          featureRelevance: 0.95,
          architecturalRelevance: 0.9,
          dependencyRelevance: 0.9,
          behavioralRelevance: 0.9,
          changeRelevance: 0.9,
          historyRelevance: 0.5,
          riskRelevance: 0.5,
          verificationRelevance: 0.5,
          recency: 0.9,
          confidence: 0.95,
          scopeRelevance: 1.0,
        },
        primaryEvidence: 'Direct target symbol',
        estimatedTokens: 200,
      };

      const result = compressionEngine.compress([candidateWithSymbol], 'COMPACT');
      expect(result.sourceFragments.length).toBe(1);
      expect(result.sourceFragments[0].symbol).toBe('AuthService.login(credentials: UserCredentials): Promise<SessionToken>');
      expect(result.compressedCandidates[0].estimatedTokens).toBeLessThan(200);
    });
  });
});
