import type { IAgentToolMapper } from '../interfaces/IAgentToolMapper.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { AgentProvider } from '../models/AgentProvider.js';

export class AgentToolMapper implements IAgentToolMapper {
  public mapToolToProviderSchema(
    tool: AgentTool,
    targetProvider: AgentProvider
  ): Record<string, unknown> {
    switch (targetProvider) {
      case 'OPENAI':
      case 'COPILOT':
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: {
              type: 'object',
              properties: tool.inputSchema.properties ?? {},
              required: tool.inputSchema.required ? [...tool.inputSchema.required] : [],
              ...(tool.inputSchema.additionalProperties !== undefined
                ? { additionalProperties: tool.inputSchema.additionalProperties }
                : {}),
            },
          },
        };

      case 'ANTHROPIC':
      case 'CLAUDE_CODE':
        return {
          name: tool.name,
          description: tool.description,
          input_schema: {
            type: 'object',
            properties: tool.inputSchema.properties ?? {},
            required: tool.inputSchema.required ? [...tool.inputSchema.required] : [],
            ...(tool.inputSchema.additionalProperties !== undefined
              ? { additionalProperties: tool.inputSchema.additionalProperties }
              : {}),
          },
        };

      case 'CURSOR':
      case 'WINDSURF':
        return {
          id: tool.toolId,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties ?? {},
            required: tool.inputSchema.required ? [...tool.inputSchema.required] : [],
          },
          readOnly: tool.safetyLevel === 'READ_ONLY',
        };

      case 'AIDER':
      case 'GENERIC':
      case 'CUSTOM':
      default:
        return {
          toolId: tool.toolId,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          version: tool.version,
          operation: tool.operation,
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties ?? {},
            required: tool.inputSchema.required ? [...tool.inputSchema.required] : [],
            additionalProperties: tool.inputSchema.additionalProperties,
          },
          safetyLevel: tool.safetyLevel,
          idempotent: tool.idempotent,
          retryable: tool.retryable,
        };
    }
  }

  public mapToolsToProviderSchemas(
    tools: readonly AgentTool[],
    targetProvider: AgentProvider
  ): Record<string, unknown>[] {
    return tools.map((t) => this.mapToolToProviderSchema(t, targetProvider));
  }
}
