import type { AgentOperationType } from './AgentOperation.js';
import type { AgentWorkspaceContext } from './AgentWorkspaceContext.js';
import type { AgentEnvironment } from './AgentEnvironment.js';

/**
 * Standard protocol envelope for incoming agent requests.
 */
export interface AgentRequest<TPayload = unknown> {
  readonly requestId: string;
  readonly protocolVersion: string;
  readonly operation: AgentOperationType;
  readonly agentId: string;
  readonly sessionId?: string | undefined;
  readonly workspaceContext: AgentWorkspaceContext;
  readonly payload: TPayload;
  readonly timestamp: string;
  readonly clientInfo?: AgentEnvironment | undefined;
  readonly traceId?: string | undefined;
}
