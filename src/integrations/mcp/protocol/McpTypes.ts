/**
 * MCP Protocol Type Definitions
 * 
 * Provider-neutral types representing the Model Context Protocol data structures,
 * JSON Schema structures, and session context within ProjectMind.
 */

export interface McpJsonSchemaProperty {
  type: string;
  description?: string | undefined;
  enum?: (string | number | boolean)[] | undefined;
  items?: McpJsonSchemaProperty | undefined;
  properties?: Record<string, McpJsonSchemaProperty> | undefined;
  required?: string[] | undefined;
  minimum?: number | undefined;
  maximum?: number | undefined;
  default?: unknown;
  [key: string]: unknown;
}

export interface McpJsonSchema {
  type: 'object';
  description?: string | undefined;
  properties: Record<string, McpJsonSchemaProperty>;
  required?: string[] | undefined;
  additionalProperties?: boolean | undefined;
  [key: string]: unknown;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpJsonSchema;
}

export interface McpTextContent {
  type: 'text';
  text: string;
}

export type McpContent = McpTextContent;

export interface McpCallToolResult {
  content: McpContent[];
  isError?: boolean | undefined;
  [key: string]: unknown;
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown> | undefined;
}

export interface McpClientInfo {
  name: string;
  version?: string | undefined;
}

export interface McpSessionContext {
  sessionId: string;
  agentId?: string | undefined;
  workspaceId: string;
  repositoryId: string;
  clientInfo?: McpClientInfo | undefined;
  startedAt: number;
  lastActiveAt: number;
}

export interface McpServerCapabilities {
  tools?: Record<string, unknown> | undefined;
}

export interface McpServerInfo {
  name: string;
  version: string;
}
