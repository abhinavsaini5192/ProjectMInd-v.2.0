import { describe, it, expect, beforeEach } from 'vitest';
import { LocalSemanticEmbeddingProvider } from '../../src/retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import { LocalSLMProvider } from '../../src/intelligence/slm/providers/LocalSLMProvider.js';
import { MockSLMProvider } from '../../src/intelligence/slm/providers/MockSLMProvider.js';
import { OllamaProvider } from '../../src/intelligence/slm/providers/OllamaProvider.js';
import { OpenAICompatibleProvider } from '../../src/intelligence/slm/providers/OpenAICompatibleProvider.js';
import { LocalHTTPProvider } from '../../src/intelligence/slm/providers/LocalHTTPProvider.js';
import { MockLLMAdapter } from '../../src/intelligence/adapters/MockLLMAdapter.js';
import { SLMInferenceClient } from '../../src/intelligence/slm/SLMClient.js';
import { SLMGateway } from '../../src/intelligence/slm/core/SLMGateway.js';
import { SLMOutputValidator } from '../../src/intelligence/slm/core/SLMOutputValidator.js';
import { SLMFallbackManager } from '../../src/intelligence/slm/core/SLMFallbackManager.js';
import { KernelEventDispatcher } from '../../src/kernel/core/KernelEventDispatcher.js';
import { SLMRequest } from '../../src/intelligence/slm/models/SLMRequest.js';
import { SLMTaskType } from '../../src/intelligence/slm/models/SLMTaskType.js';
import { SLMUnavailableError } from '../../src/intelligence/slm/errors/SLMUnavailableError.js';
import { SLMError } from '../../src/intelligence/slm/models/SLMError.js';
import { ModelAvailability } from '../../src/intelligence/slm/registry/ModelAvailability.js';
import { SLMDecisionRouter, RoutingDecision } from '../../src/intelligence/slm/routing/SLMDecisionRouter.js';
import { TrustEstimator } from '../../src/intelligence/slm/routing/TrustEstimator.js';
import { HybridRetrievalEngine } from '../../src/retrieval/engine/HybridRetrievalEngine.js';

describe('ProjectMind Remediation 4 — AI/ML Reality Audit & Capability Integrity', () => {

  describe('1. Mock and Stub Identifiability', () => {
    it('MockSLMProvider is explicitly identifiable as a mock test double', async () => {
      const mockProvider = new MockSLMProvider();
      expect(mockProvider.isMock).toBe(true);
      
      const metadata = await mockProvider.getMetadata();
      expect(metadata.provider).toBe('mock');
      expect(metadata.runtimeInfo?.['isMock']).toBe(true);
      expect(metadata.runtimeInfo?.['isNeural']).toBe(false);
      expect(metadata.runtimeInfo?.['isSimulated']).toBe(true);

      const models = await mockProvider.listModels();
      expect(models[0]?.metadata?.['isMock']).toBe(true);
      expect(models[0]?.metadata?.['isNeural']).toBe(false);
    });

    it('MockLLMAdapter is explicitly identifiable as a mock test double', () => {
      const mockAdapter = new MockLLMAdapter();
      expect(mockAdapter.isMock).toBe(true);
    });

    it('LocalSLMProvider is an explicit stub that fails truthfully (FINDING-AI-003)', async () => {
      const stubProvider = new LocalSLMProvider();
      
      // Health check truthfully returns false (not healthy / not loaded)
      const healthy = await stubProvider.isHealthy();
      expect(healthy).toBe(false);

      // Prediction throws not-implemented error rather than fabricating output
      const dummyReq: SLMRequest = { requestId: 'req_stub', model: 'local' };
      await expect(stubProvider.predict(dummyReq)).rejects.toThrow('LocalSLMProvider inference not implemented yet.');
    });

    it('SLMInferenceClient explicitly identifies heuristic fallback (FINDING-AI-003)', async () => {
      const client = new SLMInferenceClient();
      const res = await client.generate({ prompt: 'Test architecture understanding' });
      
      expect(res.backendUsed).toBe('heuristic');
      expect(res.output).toContain('[Heuristic Reply]');
    });
  });

  describe('2. Truthful Provider Health & Failure Behavior (FINDING-AI-004)', () => {
    const unreachablePort = 59998;
    const unreachableEndpoint = `http://127.0.0.1:${unreachablePort}`;

    it('OllamaProvider truthfully reports false for health check when daemon is down', async () => {
      const provider = new OllamaProvider({
        provider: 'ollama',
        model: 'llama3:8b',
        endpoint: unreachableEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 1024,
        timeout: 500
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);

      const models = await provider.listModels();
      expect(models[0]?.availability).toBe(ModelAvailability.UNAVAILABLE);
    });

    it('OllamaProvider throws SLMUnavailableError when endpoint is down instead of returning fake mock output', async () => {
      const provider = new OllamaProvider({
        provider: 'ollama',
        model: 'llama3:8b',
        endpoint: unreachableEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 1024,
        timeout: 500
      });

      await expect(provider.generate({ requestId: 'r_ollama', model: 'llama3:8b', userInput: 'hello' }))
        .rejects.toThrow(SLMUnavailableError);
    });

    it('OpenAICompatibleProvider truthfully reports false for health check when endpoint is down', async () => {
      const provider = new OpenAICompatibleProvider({
        provider: 'openai',
        model: 'gpt-4o',
        endpoint: unreachableEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 1024,
        timeout: 500
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);

      const models = await provider.listModels();
      expect(models[0]?.availability).toBe(ModelAvailability.UNAVAILABLE);
    });

    it('OpenAICompatibleProvider throws SLMUnavailableError when endpoint is down instead of returning fake mock output', async () => {
      const provider = new OpenAICompatibleProvider({
        provider: 'openai',
        model: 'gpt-4o',
        endpoint: unreachableEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 1024,
        timeout: 500
      });

      await expect(provider.generate({ requestId: 'r_openai', model: 'gpt-4o', userInput: 'hello' }))
        .rejects.toThrow(SLMUnavailableError);
    });

    it('LocalHTTPProvider truthfully reports false for health check when endpoint is down', async () => {
      const provider = new LocalHTTPProvider({
        provider: 'local',
        model: 'custom-local',
        endpoint: unreachableEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 1024,
        timeout: 500
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);

      const models = await provider.listModels();
      expect(models[0]?.availability).toBe(ModelAvailability.UNAVAILABLE);
    });
  });

  describe('3. Deterministic Embedding Verification (FINDING-AI-004)', () => {
    const provider = new LocalSemanticEmbeddingProvider(384, '1.0.0');

    it('explicitly declares non-neural FNV-1a feature hashing in its metadata', () => {
      expect(provider.metadata.isNeural).toBe(false);
      expect(provider.metadata.providerName).toBe('LOCAL_DETERMINISTIC');
      expect(provider.metadata.algorithm).toContain('FNV-1a');
      expect(provider.metadata.dimension).toBe(384);
    });

    it('produces 100% deterministic unit vectors for identical inputs', async () => {
      const text = 'class AuthenticationService { verifyToken(token: string): boolean }';
      const vec1 = await provider.embedText(text);
      const vec2 = await provider.embedText(text);

      expect(vec1.length).toBe(384);
      expect(vec2.length).toBe(384);
      expect(vec1).toEqual(vec2);

      // Cosine similarity of identical vector with itself must be 1.0
      const selfSim = LocalSemanticEmbeddingProvider.cosineSimilarity(vec1, vec2);
      expect(selfSim).toBeCloseTo(1.0, 4);
    });

    it('produces higher similarity for shared subwords than completely disjoint text', async () => {
      const base = await provider.embedText('database connection pool retry timeout');
      const related = await provider.embedText('database connections and connection pooling');
      const unrelated = await provider.embedText('frontend css flexbox navigation header styling');

      const simRelated = LocalSemanticEmbeddingProvider.cosineSimilarity(base, related);
      const simUnrelated = LocalSemanticEmbeddingProvider.cosineSimilarity(base, unrelated);

      expect(simRelated).toBeGreaterThan(simUnrelated);
    });
  });

  describe('4. Schema Validation & Hallucination Guardrails', () => {
    const knownEntities = new Set(['AuthService', 'TokenManager', 'feat_auth']);
    const validator = new SLMOutputValidator(knownEntities);

    it('rejects responses missing the prediction payload', () => {
      expect(() => {
        validator.validate({
          requestId: 'req_err',
          model: 'test-model',
          output: 'test output',
          finishReason: 'stop',
          latencyMs: 10
        });
      }).toThrow(SLMError);
    });

    it('rejects responses with malformed schema (e.g. invalid confidence)', () => {
      expect(() => {
        validator.validate({
          requestId: 'req_bad_schema',
          model: 'test-model',
          output: 'test output',
          prediction: {
            intent: 'BUG_FIX',
            relevantFeatures: ['feat_auth'],
            recommendedContext: ['AuthService'],
            reasoningSummary: 'Test',
            confidence: 5.0 // Invalid: must be <= 1.0
          },
          finishReason: 'stop',
          latencyMs: 10
        });
      }).toThrow(SLMError);
    });

    it('detects and rejects hallucinated features not present in the repository knowledge graph', () => {
      expect(() => {
        validator.validate({
          requestId: 'req_hallucinated',
          model: 'test-model',
          output: 'test output',
          prediction: {
            intent: 'BUG_FIX',
            relevantFeatures: ['invented_feature_nonexistent'],
            recommendedContext: ['AuthService'],
            reasoningSummary: 'Test',
            confidence: 0.95
          },
          finishReason: 'stop',
          latencyMs: 10
        });
      }).toThrow(/hallucinated non-existent feature: invented_feature_nonexistent/);
    });

    it('detects and rejects hallucinated context files/symbols not present in the repository', () => {
      expect(() => {
        validator.validate({
          requestId: 'req_hallucinated_ctx',
          model: 'test-model',
          output: 'test output',
          prediction: {
            intent: 'BUG_FIX',
            relevantFeatures: ['feat_auth'],
            recommendedContext: ['NonExistentFile.java'],
            reasoningSummary: 'Test',
            confidence: 0.95
          },
          finishReason: 'stop',
          latencyMs: 10
        });
      }).toThrow(/hallucinated non-existent context: NonExistentFile\.java/);
    });
  });

  describe('5. Safe Model Fallback & Pure Deterministic Operation', () => {
    let mockProvider: MockSLMProvider;
    let gateway: SLMGateway;

    beforeEach(() => {
      const knownEntities = new Set(['AuthService', 'TokenManager', 'feat_auth']);
      mockProvider = new MockSLMProvider();
      const validator = new SLMOutputValidator(knownEntities);
      const fallbackManager = new SLMFallbackManager(new KernelEventDispatcher());
      gateway = new SLMGateway(mockProvider, validator, fallbackManager);
    });

    it('falls back to deterministic candidates with dampened confidence when model hallucinates', async () => {
      mockProvider.hallucinate = true;

      const req: SLMRequest = {
        requestId: 'req_h',
        taskType: SLMTaskType.FEATURE_INTERPRETATION,
        candidateFeatures: ['feat_auth'],
        candidateEntities: ['AuthService'],
        intentType: 'BUG_FIX'
      };

      const result = await gateway.getPrediction(req);
      expect(result.confidence).toBe(0.1);
      expect(result.reasoningSummary).toContain('Deterministic fallback activated');
      expect(result.relevantFeatures).toEqual(['feat_auth']);
      expect(result.recommendedContext).toEqual(['AuthService']);
    });

    it('falls back to deterministic candidates with dampened confidence when model fails', async () => {
      mockProvider.shouldFail = true;

      const req: SLMRequest = {
        requestId: 'req_fail',
        taskType: SLMTaskType.FEATURE_INTERPRETATION,
        candidateFeatures: ['feat_auth'],
        candidateEntities: ['AuthService'],
        intentType: 'FEATURE_ADD'
      };

      const result = await gateway.getPrediction(req);
      expect(result.confidence).toBe(0.1);
      expect(result.reasoningSummary).toContain('Deterministic fallback activated');
    });

    it('security-critical tasks are strictly routed to DETERMINISTIC_ONLY', () => {
      const trustEstimator = new TrustEstimator();
      trustEstimator.updateTrust(SLMTaskType.FEATURE_INTERPRETATION, 1.0, 0);

      const router = new SLMDecisionRouter(trustEstimator, 0.7);
      const decision = router.routeTask(SLMTaskType.FEATURE_INTERPRETATION, true);

      expect(decision).toBe(RoutingDecision.DETERMINISTIC_ONLY);
    });

    it('hybrid retrieval functions 100% reliably without any embedding provider or semantic index', async () => {
      // Instantiated with NO semanticIndex and NO embeddingProvider
      const retrievalEngine = new HybridRetrievalEngine();

      const results = await retrievalEngine.retrieve({
        queryId: 'q_det',
        text: 'auth token login',
        queryType: 'CODE',
        workspaceId: 'ws_prod',
        repositoryId: 'repo_main',
        timestamp: Date.now()
      });

      // Should complete cleanly without error even with no AI/embedding engine
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
