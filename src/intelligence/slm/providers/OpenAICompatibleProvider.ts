import { ISLMProvider } from './ISLMProvider';
import { ISLMProvider as IGatewayProvider } from '../interfaces/ISLMProvider';
import { SLMRequest } from '../models/SLMRequest';
import { SLMResponse, SLMPrediction } from '../models/SLMResponse';
import { SLMCapabilities } from '../models/SLMCapabilities';
import { ModelMetadata } from '../models/ModelMetadata';
import { SLMConfig } from '../models/SLMConfig';
import { SLMTimeoutError } from '../errors/SLMTimeoutError';
import { SLMUnavailableError } from '../errors/SLMUnavailableError';
import { SLMResponseError } from '../errors/SLMResponseError';
import { ModelRecord } from '../registry/ModelRecord';
import { ModelAvailability } from '../registry/ModelAvailability';

export class OpenAICompatibleProvider implements ISLMProvider, IGatewayProvider {
  constructor(private config: SLMConfig) {}

  async generate(request: SLMRequest): Promise<SLMResponse> {
    const startTime = Date.now();
    const timeout = request.timeout || this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const endpoint = (this.config.endpoint || 'https://api.openai.com').replace(/\/+$/, '');
      const url = `${endpoint}/v1/chat/completions`;
      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemInstructions) {
        messages.push({ role: 'system', content: request.systemInstructions });
      }
      messages.push({ role: 'user', content: request.userInput || request.taskDescription || '' });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature ?? 0.1,
          max_tokens: this.config.maxOutputTokens ?? 256
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new SLMResponseError(`OpenAI HTTP error ${res.status}: ${res.statusText}`, 'openai', errorText);
      }

      const data = await res.json() as any;
      const choice = data.choices?.[0];
      const outputText = choice?.message?.content || '';

      let structured: any = undefined;
      try {
        const cleaned = outputText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        structured = JSON.parse(cleaned);
      } catch {
        // Plain text output
      }

      return {
        requestId: request.requestId,
        model: this.config.model,
        output: outputText,
        structuredOutput: structured,
        finishReason: choice?.finish_reason || 'stop',
        latencyMs: Date.now() - startTime
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new SLMTimeoutError('OpenAI request timed out', 'openai', timeout);
      }
      if (e instanceof SLMResponseError) {
        throw e;
      }
      if (e.message?.includes('fetch failed') || e.code === 'ECONNREFUSED' || e.cause?.code === 'ECONNREFUSED') {
        throw new SLMUnavailableError(`Connection refused to OpenAI endpoint ${this.config.endpoint}`, 'openai', this.config.model);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async predict(request: SLMRequest): Promise<SLMResponse> {
    const candidateFeatures = (request.candidateFeatures || []).join(', ');
    const candidateEntities = (request.candidateEntities || []).join(', ');

    const systemPrompt = [
      'You are a software repository intelligence model.',
      'Analyze the task description and candidates, then respond ONLY with a JSON object adhering to this schema:',
      '{',
      `  "intent": "${request.intentType || 'BUG_FIX'}",`,
      `  "relevantFeatures": string[] (select ONLY from: [${candidateFeatures}]),`,
      `  "recommendedContext": string[] (select ONLY from: [${candidateEntities}]),`,
      '  "reasoningSummary": string (brief justification for these selections),',
      '  "confidence": number (between 0.0 and 1.0)',
      '}',
      'Do not include markdown fences or any explanation outside the JSON object.'
    ].join('\n');

    const prompt = request.taskDescription || request.userInput || 'Analyze repository task';
    const response = await this.generate({
      ...request,
      systemInstructions: systemPrompt,
      userInput: prompt,
      structuredOutputExpected: true
    });

    let prediction: SLMPrediction | undefined = undefined;
    if (response.structuredOutput && typeof response.structuredOutput === 'object') {
      prediction = response.structuredOutput as SLMPrediction;
    }

    return {
      ...response,
      prediction
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.healthCheck();
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.endpoint) return false;
    try {
      const endpoint = this.config.endpoint.replace(/\/+$/, '');
      const url = `${endpoint}/v1/models`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Math.min(this.config.timeout || 2000, 3000));
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  getCapabilities(): SLMCapabilities {
    return {
      model: this.config.model,
      provider: 'openai',
      supportedTasks: ['FEATURE_INTERPRETATION', 'CONTEXT_RANKING', 'REASONING_SUMMARY', 'SEMANTIC_SIMILARITY'],
      contextWindow: this.config.contextWindow || 8192,
      maxContextTokens: this.config.contextWindow || 8192,
      supportsStreaming: true,
      supportsStructuredOutput: true,
      supportsToolCalling: true,
      supportsEmbeddings: false,
      supportsVision: false,
      supportsSystemPrompt: true,
      structuredOutputSupported: true
    };
  }

  async getMetadata(): Promise<ModelMetadata> {
    return {
      provider: 'openai',
      modelName: this.config.model,
      contextWindow: this.config.contextWindow || 8192,
      capabilities: this.getCapabilities(),
      runtimeInfo: {
        endpoint: this.config.endpoint,
        isNeural: true,
        isMock: false
      }
    };
  }

  async listModels(): Promise<ModelRecord[]> {
    const isHealthy = await this.healthCheck();
    return [{
      modelId: `openai-${this.config.model}`,
      modelName: this.config.model,
      providerId: 'openai',
      providerType: 'openai',
      capabilities: this.getCapabilities(),
      contextWindow: this.config.contextWindow || 8192,
      availability: isHealthy ? ModelAvailability.AVAILABLE : ModelAvailability.UNAVAILABLE,
      metadata: {
        isNeural: true,
        isMock: false
      },
      lastSeen: Date.now()
    }];
  }
}


