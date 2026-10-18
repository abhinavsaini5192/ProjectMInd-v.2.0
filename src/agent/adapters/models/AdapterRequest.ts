import type { AgentProtocol } from './AgentProtocol.js';
import type { AgentOperationType } from '../../models/AgentOperation.js';
import type { AgentWorkspaceContext } from '../../models/AgentWorkspaceContext.js';
import type { AgentEnvironment } from '../../models/AgentEnvironment.js';

export interface AdapterRequest<TPayload = unknown> {
  readonly requestId: string;
  readonly providerRequestId?: string | undefined;
  readonly adapterId: string;
  readonly protocol: AgentProtocol;
  readonly protocolVersion: string;
  readonly operation: AgentOperationType;
  readonly agentId: string;
  readonly sessionId?: string | undefined;
  readonly providerSessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly workspaceContext: AgentWorkspaceContext;
  readonly payload: TPayload;
  readonly timestamp: string;
  readonly clientInfo?: AgentEnvironment | undefined;
  readonly traceId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
