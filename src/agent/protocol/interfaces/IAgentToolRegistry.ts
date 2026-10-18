import type { AgentTool } from '../models/AgentTool.js';
import type { ToolCategory } from '../models/ToolCategory.js';
import type { ToolDiscoveryResponse } from '../models/ToolDiscoveryResponse.js';
import type { AgentCapability } from '../../models/AgentCapability.js';

export interface IAgentToolRegistry {
  registerTool(tool: AgentTool): void;
  unregisterTool(toolName: string): boolean;
  getTool(toolName: string): AgentTool | undefined;
  listTools(): readonly AgentTool[];
  getToolsByCategory(category: ToolCategory): readonly AgentTool[];
  getToolsForCapabilities(capabilities: readonly AgentCapability[]): readonly AgentTool[];
  isToolAvailable(toolName: string): boolean;
  validateTool(tool: AgentTool): void;
  getDiscoveryInfo(agentCapabilities?: readonly AgentCapability[]): ToolDiscoveryResponse;
}
