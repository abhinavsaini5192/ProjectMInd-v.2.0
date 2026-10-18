import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { AgentProvider } from '../models/AgentProvider.js';

export interface IAgentToolMapper {
  mapToolToProviderSchema(tool: AgentTool, targetProvider: AgentProvider): Record<string, unknown>;
  mapToolsToProviderSchemas(tools: readonly AgentTool[], targetProvider: AgentProvider): Record<string, unknown>[];
}
