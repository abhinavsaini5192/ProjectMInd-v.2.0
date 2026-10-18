export interface SLMPrediction {
  intent: string;
  relevantFeatures: string[];
  recommendedContext: string[];
  reasoningSummary: string;
  confidence: number;
}

export interface SLMResponse {
  requestId: string;
  model: string;
  output: string;
  structuredOutput?: any;
  prediction?: SLMPrediction;
  finishReason: 'stop' | 'length' | 'timeout' | 'error' | 'unknown';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  metadata?: Record<string, any>;
}
