export interface ToolResponseError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: unknown | undefined;
}

export interface ToolResponseMetadata {
  readonly durationMs: number;
  readonly timestamp: string;
  readonly protocolVersion: string;
  readonly knowledgeVersion?: string | undefined;
  readonly freshness?: string | undefined;
  readonly cached?: boolean | undefined;
}

/**
 * Canonical tool response envelope.
 */
export interface ToolResponse {
  readonly requestId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly result?: unknown | undefined;
  readonly warnings: readonly string[];
  readonly error?: ToolResponseError | undefined;
  readonly metadata: ToolResponseMetadata;
  readonly protocolVersion: string;
  readonly timestamp: string;
}
