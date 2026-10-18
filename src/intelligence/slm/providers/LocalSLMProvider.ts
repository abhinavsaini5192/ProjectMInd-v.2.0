import { ISLMProvider } from '../interfaces/ISLMProvider.js';
import { SLMRequest } from '../models/SLMRequest.js';
import { SLMResponse } from '../models/SLMResponse.js';
import { SLMCapabilities } from '../models/SLMCapabilities.js';

export class LocalSLMProvider implements ISLMProvider {
  getCapabilities(): SLMCapabilities {
    return {
      model: 'local-onnx-llama-3-8b', // Placeholder
      provider: 'local-onnx',
      supportedTasks: ['FEATURE_INTERPRETATION', 'CONTEXT_RANKING'],
      contextWindow: 8192,
      maxContextTokens: 8192,
      supportsStreaming: false,
      supportsStructuredOutput: true,
      supportsToolCalling: false,
      supportsEmbeddings: false,
      supportsVision: false,
      supportsSystemPrompt: true,
      structuredOutputSupported: true
    };
  }

  async isHealthy(): Promise<boolean> {
    // In reality, this would check if the local inference engine (e.g. ONNX Runtime) is loaded and ready
    return false; // Not implemented for this phase
  }

  async predict(request: SLMRequest): Promise<SLMResponse> {
    throw new Error('LocalSLMProvider inference not implemented yet.');
  }
}
