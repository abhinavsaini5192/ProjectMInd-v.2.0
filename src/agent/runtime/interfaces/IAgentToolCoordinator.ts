import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { ToolResponse } from '../../protocol/models/ToolResponse.js';
import type { AgentSession } from '../../models/AgentSession.js';

export interface IAgentToolCoordinator {
  executeTool(request: ToolRequest, session?: AgentSession | undefined): Promise<ToolResponse>;
  validatePermissions(toolName: string, session?: AgentSession | undefined): boolean;
}
