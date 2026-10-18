import type { ToolRequest } from '../models/ToolRequest.js';
import type { ToolResponse } from '../models/ToolResponse.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentToolHandler } from './IAgentToolHandler.js';
import type { IAgentToolRegistry } from './IAgentToolRegistry.js';

export interface IAgentToolPipeline {
  execute(request: ToolRequest, session?: AgentSession | undefined): Promise<ToolResponse>;
  registerHandler(handler: IAgentToolHandler): void;
  getRegistry(): IAgentToolRegistry;
}
