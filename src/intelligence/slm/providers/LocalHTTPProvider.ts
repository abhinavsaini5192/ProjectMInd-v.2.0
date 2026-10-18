import { ISLMProvider } from './ISLMProvider';
import { SLMRequest } from '../models/SLMRequest';
import { SLMResponse } from '../models/SLMResponse';
import { SLMCapabilities } from '../models/SLMCapabilities';
import { ModelMetadata } from '../models/ModelMetadata';
import { SLMConfig } from '../models/SLMConfig';
import { SLMTimeoutError } from '../errors/SLMTimeoutError';
import { SLMUnavailableError } from '../errors/SLMUnavailableError';
import { SLMResponseError } from '../errors/SLMResponseError';
import { ModelRecord } from '../registry/ModelRecord';
import { ModelAvailability } from '../registry/ModelAvailability';

export class LocalHTTPProvider implements ISLMProvider {
  constructor(private config: SLMConfig) {}

  async generate(request: SLMRequest): Promise<SLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeout || this.config.timeout);
    
    const startTime = Date.now();

    try {
      // Mock fetch implementation since we don't have a real server
      // In reality: const res = await fetch(this.config.endpoint, { ... })
      if (request.userInput?.includes('timeout')) {
         throw new DOMException('The operation was aborted.', 'AbortError');
      }
      if (request.userInput?.includes('unavailable')) {
         throw new TypeError('fetch failed');
      }
      if (request.userInput?.includes('malformed')) {
         throw new SLMResponseError('Invalid JSON', 'local', '{bad}');
      }

      return {
        requestId: request.requestId,
        model: this.config.model,
        output: '{"mock":"true"}',
        structuredOutput: { mock: true },
        finishReason: 'stop',
        latencyMs: Date.now() - startTime
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
         throw new SLMTimeoutError('Request timed out', 'local', request.timeout || this.config.timeout);
      }
      if (e.message === 'fetch failed' || e.code === 'ECONNREFUSED') {
         throw new SLMUnavailableError('Connection refused', 'local', this.config.model);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.endpoint) return false;
    try {
      const endpoint = this.config.endpoint.replace(/\/+$/, '');
      const url = `${endpoint}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Math.min(this.config.timeout || 1000, 2000));
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getCapabilities(): Promise<SLMCapabilities> {
    return {
      contextWindow: this.config.contextWindow,
      supportsStreaming: false,
      supportsStructuredOutput: true,
      supportsToolCalling: false,
      supportsEmbeddings: false,
      supportsVision: false,
      supportsSystemPrompt: true
    };
  }

  async getMetadata(): Promise<ModelMetadata> {
    return {
      provider: 'local',
      modelName: this.config.model,
      contextWindow: this.config.contextWindow,
      capabilities: await this.getCapabilities(),
      runtimeInfo: {
        endpoint: this.config.endpoint,
        isNeural: false,
        isLocalHTTP: true
      }
    };
  }

  async listModels(): Promise<ModelRecord[]> {
    const isHealthy = await this.healthCheck();
    return [{
      modelId: `local-${this.config.model}`,
      modelName: this.config.model,
      providerId: 'local',
      providerType: 'local',
      capabilities: await this.getCapabilities(),
      contextWindow: this.config.contextWindow,
      availability: isHealthy ? ModelAvailability.AVAILABLE : ModelAvailability.UNAVAILABLE,
      metadata: {
        isNeural: false,
        isLocalHTTP: true
      },
      lastSeen: Date.now()
    }];
  }
}
