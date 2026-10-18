/**
 * Canonical tool invocation request envelope.
 */
export interface ToolRequest {
  readonly requestId: string;
  readonly sessionId?: string | undefined;
  readonly agentId: string;
  readonly protocolVersion: string;
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown> | undefined;
}
