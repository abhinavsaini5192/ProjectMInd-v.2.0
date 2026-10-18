import type { AgentOperationType } from '../models/AgentOperation.js';
import type { IAgentOperationHandler } from './IAgentOperationHandler.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';

export interface IAgentOperationRouter {
  registerHandler(handler: IAgentOperationHandler): void;
  getHandler(operation: AgentOperationType): IAgentOperationHandler | undefined;
  route(request: AgentRequest, session?: AgentSession | undefined): Promise<unknown>;
}
