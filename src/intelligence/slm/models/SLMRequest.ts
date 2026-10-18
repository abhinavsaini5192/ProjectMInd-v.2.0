export interface SLMRequest {
  requestId: string;
  sessionId?: string;
  model?: string;
  taskType?: string;
  taskDescription?: string;
  promptVersion?: string;
  intentType?: string;
  repositoryId?: string;
  snapshotId?: string;
  candidateFeatures?: string[];
  candidateEntities?: string[];
  maxTokens?: number;
  temperature?: number;
  systemInstructions?: string;
  userInput?: string;
  structuredContext?: any;
  generationParameters?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
  };
  maxOutputTokens?: number;
  timeout?: number;
  metadata?: Record<string, any>;
  [key: string]: any;
}
