import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';

export interface IAgentOperationHandler<TPayload = unknown, TResult = unknown> {
  readonly operation: AgentOperationType;
  readonly requiredCapabilities: readonly AgentCapability[];
  handle(request: AgentRequest<TPayload>, session?: AgentSession | undefined): Promise<TResult>;
}
