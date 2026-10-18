import { ISLMProvider } from './ISLMProvider';
import { ISLMProvider as IGatewayProvider } from '../interfaces/ISLMProvider';
import { SLMRequest } from '../models/SLMRequest';
import { SLMResponse } from '../models/SLMResponse';
import { SLMCapabilities } from '../models/SLMCapabilities';
import { ModelMetadata } from '../models/ModelMetadata';
import { SLMResponseError } from '../errors/SLMResponseError';
import { SLMUnavailableError } from '../errors/SLMUnavailableError';
import { ModelRecord } from '../registry/ModelRecord';
import { ModelAvailability } from '../registry/ModelAvailability';

export class MockSLMProvider implements ISLMProvider, IGatewayProvider {
  public readonly isMock: boolean = true;
  public hallucinate = false;
  public shouldFail = false;
  private overrideResponse: Partial<SLMResponse> | null = null;
  private overrideError: Error | null = null;

  public setOverrideResponse(response: Partial<SLMResponse>) {
    this.overrideResponse = response;
    this.overrideError = null;
  }

  public setOverrideError(error: Error) {
    this.overrideError = error;
    this.overrideResponse = null;
  }

  async generate(request: SLMRequest): Promise<SLMResponse> {
    if (this.overrideError) throw this.overrideError;

    if (this.overrideResponse) {
       return {
          requestId: request.requestId,
          model: 'mock-model',
          output: this.overrideResponse.output || '',
          structuredOutput: this.overrideResponse.structuredOutput,
          finishReason: this.overrideResponse.finishReason || 'stop',
          latencyMs: this.overrideResponse.latencyMs || 50
       };
    }

    return {
      requestId: request.requestId,
      model: 'mock-model',
      output: 'Mock successful generation',
      structuredOutput: { decisionType: 'MODIFY_CODE', confidence: 0.9, targets: ['src/index.ts'] },
      finishReason: 'stop',
      latencyMs: 50
    };
  }

  async healthCheck(): Promise<boolean> {
    if (this.overrideError instanceof SLMUnavailableError) return false;
    return true;
  }

  getCapabilities(): SLMCapabilities {
    return {
      model: 'mock-model',
      provider: 'mock',
      supportedTasks: ['FEATURE_INTERPRETATION', 'CONTEXT_RANKING'],
      contextWindow: 8192,
      maxContextTokens: 8192,
      supportsStreaming: false,
      supportsStructuredOutput: true,
      supportsToolCalling: false,
      supportsEmbeddings: false,
      supportsVision: false,
      supportsSystemPrompt: true,
      structuredOutputSupported: true,
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.healthCheck();
  }

  async predict(request: SLMRequest): Promise<SLMResponse> {
    if (this.shouldFail) {
      throw new Error('Simulated provider failure');
    }

    if (this.hallucinate) {
      return {
        requestId: request.requestId,
        model: 'mock-model',
        output: 'Hallucinated output',
        prediction: {
          intent: 'BUG_FIX',
          relevantFeatures: ['hallucinated_feature_xyz'],
          recommendedContext: ['hallucinated_context_xyz'],
          reasoningSummary: 'Hallucinated reasoning',
          confidence: 0.99,
        },
        finishReason: 'stop',
        latencyMs: 10,
      };
    }

    return {
      requestId: request.requestId,
      model: 'mock-model',
      output: 'Mock prediction output',
      prediction: {
        intent: request.intentType ?? 'BUG_FIX',
        relevantFeatures: request.candidateFeatures ?? ['feat_auth'],
        recommendedContext: request.candidateEntities ?? ['AuthService'],
        reasoningSummary: 'Mock SLM reasoning summary',
        confidence: 0.95,
      },
      finishReason: 'stop',
      latencyMs: 10,
    };
  }

  async getMetadata(): Promise<ModelMetadata> {
    return {
      provider: 'mock',
      modelName: 'mock-model',
      contextWindow: 8192,
      capabilities: this.getCapabilities(),
      runtimeInfo: {
        isMock: true,
        isNeural: false,
        isSimulated: true
      }
    };
  }

  async listModels(): Promise<ModelRecord[]> {
    return [{
      modelId: 'mock-mock-model',
      modelName: 'mock-model',
      providerId: 'mock',
      providerType: 'mock',
      capabilities: await this.getCapabilities(),
      contextWindow: 8192,
      availability: ModelAvailability.AVAILABLE,
      metadata: {
        isMock: true,
        isNeural: false,
        isSimulated: true
      },
      lastSeen: Date.now()
    }];
  }
}
