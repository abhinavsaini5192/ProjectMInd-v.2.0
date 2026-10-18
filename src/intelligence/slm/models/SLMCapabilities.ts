export interface SLMCapabilities {
  model?: string;
  provider?: string;
  supportedTasks?: string[];
  maxContextTokens?: number;
  structuredOutputSupported?: boolean;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  supportsEmbeddings: boolean;
  supportsVision: boolean;
  supportsSystemPrompt: boolean;
}
