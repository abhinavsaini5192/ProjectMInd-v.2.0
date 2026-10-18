import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';

export interface IAgentToolHandler {
  readonly toolName: string;
  getToolDefinition(): AgentTool;
  validate?(request: ToolRequest): Promise<void> | void;
  execute(request: ToolRequest, session?: AgentSession | undefined): Promise<Record<string, unknown>>;
}
