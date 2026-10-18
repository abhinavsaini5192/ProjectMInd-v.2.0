import { describe, it, expect, beforeEach } from 'vitest';
import { OllamaProvider } from '../../src/intelligence/slm/providers/OllamaProvider.js';
import { OpenAICompatibleProvider } from '../../src/intelligence/slm/providers/OpenAICompatibleProvider.js';
import { SLMGateway } from '../../src/intelligence/slm/core/SLMGateway.js';
import { SLMOutputValidator } from '../../src/intelligence/slm/core/SLMOutputValidator.js';
import { SLMFallbackManager } from '../../src/intelligence/slm/core/SLMFallbackManager.js';
import { KernelEventDispatcher } from '../../src/kernel/core/KernelEventDispatcher.js';
import { SLMRequest } from '../../src/intelligence/slm/models/SLMRequest.js';
import { SLMTaskType } from '../../src/intelligence/slm/models/SLMTaskType.js';
import { SLMUnavailableError } from '../../src/intelligence/slm/errors/SLMUnavailableError.js';
import { SLMTimeoutError } from '../../src/intelligence/slm/errors/SLMTimeoutError.js';
import { SLMResponseError } from '../../src/intelligence/slm/errors/SLMResponseError.js';
import { SLMError } from '../../src/intelligence/slm/models/SLMError.js';
import { ModelAvailability } from '../../src/intelligence/slm/registry/ModelAvailability.js';
import { SLMDecisionRouter, RoutingDecision } from '../../src/intelligence/slm/routing/SLMDecisionRouter.js';
import { TrustEstimator } from '../../src/intelligence/slm/routing/TrustEstimator.js';
import { SemanticChunker } from '../../src/retrieval/index/SemanticChunker.js';
import { HybridRetrievalEngine } from '../../src/retrieval/engine/HybridRetrievalEngine.js';

describe('ProjectMind Remediation 5 — Live Model Integration & Failure Handling', () => {
  const ollamaEndpoint = 'http://127.0.0.1:11434';
  const liveModel = 'qwen2.5:0.5b';

  // Check if live Ollama daemon is reachable
  let isLiveOllamaAvailable = false;

  beforeEach(async () => {
    try {
      const probe = new OllamaProvider({
        provider: 'ollama',
        model: liveModel,
        endpoint: ollamaEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 128,
        timeout: 1500
      });
      isLiveOllamaAvailable = await probe.healthCheck();
    } catch {
      isLiveOllamaAvailable = false;
    }
  });

  describe('1. Live Model Inference & End-to-End Workflow', () => {
    it('executes real end-to-end model inference when live Ollama daemon is active', async () => {
      if (!isLiveOllamaAvailable) {
        console.warn('[SKIP] Live Ollama daemon not available for real inference test.');
        return;
      }

      // Step 1: Extract repository facts deterministically
      const code = `
export class AuthService {
  public authenticate(token: string): boolean {
    return token.startsWith('pm_');
  }
}
export class TokenManager {
  public issueToken(userId: string): string {
    return 'pm_' + userId;
  }
}
      `.trim();
      const chunks = SemanticChunker.chunkSourceFile('src/auth/AuthService.ts', code, 'v1');
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      const knownEntities = new Set([
        'src/auth/AuthService.ts',
        'AuthService',
        'TokenManager',
        'feat_auth'
      ]);

      // Step 2: Configure Ollama provider
      const provider = new OllamaProvider({
        provider: 'ollama',
        model: liveModel,
        endpoint: ollamaEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 256,
        timeout: 30000
      });

      const validator = new SLMOutputValidator(knownEntities);
      const fallbackManager = new SLMFallbackManager(new KernelEventDispatcher());
      const gateway = new SLMGateway(provider, validator, fallbackManager);

      // Step 3: Issue structured prediction request
      const request: SLMRequest = {
        requestId: 'req_live_test_1',
        taskType: SLMTaskType.FEATURE_INTERPRETATION,
        taskDescription: 'Fix authentication token verification bug in TokenManager for feat_auth',
        intentType: 'BUG_FIX',
        candidateFeatures: ['feat_auth'],
        candidateEntities: ['AuthService', 'TokenManager']
      };

      const startTime = Date.now();
      const prediction = await gateway.getPrediction(request);
      const durationMs = Date.now() - startTime;

      // Step 4: Verify real inference results
      expect(prediction).toBeDefined();
      expect(prediction.intent).toBe('BUG_FIX');
      expect(prediction.confidence).toBeGreaterThan(0.0);
      expect(prediction.confidence).toBeLessThanOrEqual(1.0);
      expect(typeof prediction.reasoningSummary).toBe('string');
      expect(prediction.reasoningSummary.length).toBeGreaterThan(5);

      // Candidate containment verified
      for (const feat of prediction.relevantFeatures) {
        expect(knownEntities.has(feat)).toBe(true);
      }
      for (const ctx of prediction.recommendedContext) {
        expect(knownEntities.has(ctx)).toBe(true);
      }

      // Verify latency was recorded
      expect(durationMs).toBeGreaterThan(0);
    }, 60000);

    it('listModels discovers models with ModelAvailability.AVAILABLE when endpoint is healthy', async () => {
      if (!isLiveOllamaAvailable) return;

      const provider = new OllamaProvider({
        provider: 'ollama',
        model: liveModel,
        endpoint: ollamaEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 128,
        timeout: 2000
      });

      const models = await provider.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]?.availability).toBe(ModelAvailability.AVAILABLE);
      expect(models[0]?.providerType).toBe('ollama');
    });
  });

  describe('2. Failure & Fallback Verification (Deterministic Test Suite)', () => {
    const unreachableEndpoint = 'http://127.0.0.1:59997';
    const knownEntities = new Set(['AuthService', 'TokenManager', 'feat_auth']);

    it('activates deterministic fallback when endpoint is unreachable', async () => {
      const brokenProvider = new OllamaProvider({
        provider: 'ollama',
        model: 'any-model',
        endpoint: unreachableEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 128,
        timeout: 500
      });

      const validator = new SLMOutputValidator(knownEntities);
      const fallbackManager = new SLMFallbackManager(new KernelEventDispatcher());
      const gateway = new SLMGateway(brokenProvider, validator, fallbackManager);

      const request: SLMRequest = {
        requestId: 'req_unreachable',
        taskType: SLMTaskType.FEATURE_INTERPRETATION,
        taskDescription: 'Fix auth bug',
        intentType: 'BUG_FIX',
        candidateFeatures: ['feat_auth'],
        candidateEntities: ['AuthService']
      };

      const result = await gateway.getPrediction(request);
      expect(result.confidence).toBe(0.1);
      expect(result.reasoningSummary).toContain('Deterministic fallback activated');
      expect(result.relevantFeatures).toEqual(['feat_auth']);
      expect(result.recommendedContext).toEqual(['AuthService']);
    });

    it('surfaces SLMTimeoutError when request exceeds configured timeout boundary', async () => {
      const timeoutProvider = new OllamaProvider({
        provider: 'ollama',
        model: liveModel,
        endpoint: ollamaEndpoint,
        temperature: 0.1,
        contextWindow: 8192,
        maxOutputTokens: 128,
        timeout: 1 // 1ms forces timeout
      });

      await expect(
        timeoutProvider.generate({ requestId: 'r_timeout', model: liveModel, userInput: 'Hello' })
      ).rejects.toThrow(SLMTimeoutError);
    });

    it('rejects schema-invalid model output and triggers deterministic fallback', async () => {
      const validator = new SLMOutputValidator(knownEntities);
      const fallbackManager = new SLMFallbackManager(new KernelEventDispatcher());

      // Mock provider returning invalid schema (confidence > 1.0)
      const invalidSchemaProvider = {
        getCapabilities: () => ({
          model: 'test',
          provider: 'ollama',
          supportedTasks: ['FEATURE_INTERPRETATION'],
          contextWindow: 8192,
          maxContextTokens: 8192,
          supportsStreaming: false,
          supportsStructuredOutput: true,
          supportsToolCalling: false,
          supportsEmbeddings: false,
          supportsVision: false,
          supportsSystemPrompt: true,
          structuredOutputSupported: true
        }),
        predict: async () => ({
          requestId: 'r_bad_schema',
          model: 'test',
          output: 'bad',
          prediction: {
            intent: 'BUG_FIX',
            relevantFeatures: ['feat_auth'],
            recommendedContext: ['AuthService'],
            reasoningSummary: 'Invalid confidence score',
            confidence: 99.0 // Invalid Zod: max is 1.0
          },
          finishReason: 'stop' as const,
          latencyMs: 10
        }),
        isHealthy: async () => true
      };

      const gateway = new SLMGateway(invalidSchemaProvider as any, validator, fallbackManager);
      const result = await gateway.getPrediction({
        requestId: 'r_bad_schema',
        taskType: SLMTaskType.FEATURE_INTERPRETATION,
        candidateFeatures: ['feat_auth'],
        candidateEntities: ['AuthService']
      });

      expect(result.confidence).toBe(0.1);
      expect(result.reasoningSummary).toContain('Deterministic fallback activated');
    });

    it('rejects hallucinated repository entities and triggers deterministic fallback', async () => {
      const validator = new SLMOutputValidator(knownEntities);
      const fallbackManager = new SLMFallbackManager(new KernelEventDispatcher());

      const hallucinatingProvider = {
        getCapabilities: () => ({
          model: 'test',
          provider: 'ollama',
          supportedTasks: ['FEATURE_INTERPRETATION'],
          contextWindow: 8192,
          maxContextTokens: 8192,
          supportsStreaming: false,
          supportsStructuredOutput: true,
          supportsToolCalling: false,
          supportsEmbeddings: false,
          supportsVision: false,
          supportsSystemPrompt: true,
          structuredOutputSupported: true
        }),
        predict: async () => ({
          requestId: 'r_hallucination',
          model: 'test',
          output: 'hallucinated',
          prediction: {
            intent: 'BUG_FIX',
            relevantFeatures: ['invented_feature_nonexistent'],
            recommendedContext: ['AuthService'],
            reasoningSummary: 'Hallucinated feature',
            confidence: 0.9
          },
          finishReason: 'stop' as const,
          latencyMs: 10
        }),
        isHealthy: async () => true
      };

      const gateway = new SLMGateway(hallucinatingProvider as any, validator, fallbackManager);
      const result = await gateway.getPrediction({
        requestId: 'r_hallucination',
        taskType: SLMTaskType.FEATURE_INTERPRETATION,
        candidateFeatures: ['feat_auth'],
        candidateEntities: ['AuthService']
      });

      expect(result.confidence).toBe(0.1);
      expect(result.reasoningSummary).toContain('Deterministic fallback activated');
    });

    it('security-critical operations strictly bypass SLM and route to DETERMINISTIC_ONLY', () => {
      const trustEstimator = new TrustEstimator();
      trustEstimator.updateTrust(SLMTaskType.FEATURE_INTERPRETATION, 1.0, 0);

      const router = new SLMDecisionRouter(trustEstimator, 0.7);
      const routing = router.routeTask(SLMTaskType.FEATURE_INTERPRETATION, true);

      expect(routing).toBe(RoutingDecision.DETERMINISTIC_ONLY);
    });

    it('deterministic hybrid retrieval functions completely offline without any model', async () => {
      const engine = new HybridRetrievalEngine();
      const results = await engine.retrieve({
        queryId: 'q_offline',
        text: 'auth security token',
        queryType: 'CODE',
        workspaceId: 'ws_test',
        repositoryId: 'repo_test',
        timestamp: Date.now()
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });
});
