export type AgentResponseStatus = 'SUCCESS' | 'ERROR' | 'PARTIAL';

export interface AgentResponseMetadata {
  readonly durationMs: number;
  readonly timestamp: string;
  readonly protocolVersion: string;
  readonly traceId?: string | undefined;
  readonly tokensUsed?: number | undefined;
  readonly cacheHit?: boolean | undefined;
}

export interface AgentResponseError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * Standard protocol envelope for agent responses.
 */
export interface AgentResponse<TData = unknown> {
  readonly requestId: string;
  readonly status: AgentResponseStatus;
  readonly data?: TData | undefined;
  readonly error?: AgentResponseError | undefined;
  readonly metadata: AgentResponseMetadata;
}
