import type { McpToolDefinition, McpToolCallParams, McpCallToolResult, McpSessionContext } from '../protocol/McpTypes.js';

/**
 * Adapter interface translating MCP tool discovery and execution requests
 * to the canonical ProjectMind AgentToolPipeline.
 */
export interface IMcpToolAdapter {
  /**
   * Discovers and lists all tools dynamically from the canonical tool registry,
   * returning them formatted as MCP tool definitions with Draft-7 JSON schemas.
   */
  listTools(): Promise<McpToolDefinition[]>;

  /**
   * Executes a tool by delegating through the canonical AgentToolPipeline,
   * returning an MCP CallToolResult.
   */
  executeTool(
    params: McpToolCallParams,
    sessionContext: McpSessionContext
  ): Promise<McpCallToolResult>;
}
