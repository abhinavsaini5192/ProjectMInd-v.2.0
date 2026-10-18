import { describe, it, expect } from 'vitest';
import { McpErrorMapper } from '../../../src/integrations/mcp/errors/McpErrorMapper.js';
import { McpError } from '../../../src/integrations/mcp/errors/McpError.js';
import { McpErrorCodes } from '../../../src/integrations/mcp/errors/McpErrorCodes.js';
import { ToolNotFoundError } from '../../../src/agent/protocol/errors/ToolNotFoundError.js';
import { ToolArgumentError } from '../../../src/agent/protocol/errors/ToolArgumentError.js';
import { ToolScopeError } from '../../../src/agent/protocol/errors/ToolScopeError.js';

describe('MCP Error Mapping', () => {
  it('maps ToolError to MCP CallToolResult with isError: true and requestId', () => {
    const error = new ToolNotFoundError('Tool xyz is missing', { toolName: 'xyz' }, 'req-1234');
    const result = McpErrorMapper.toCallToolResult(error);

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');
    expect(result.content[0]?.text).toContain('[Error TOOL_NOT_FOUND]');
    expect(result.content[0]?.text).toContain('Tool xyz is missing');
    expect(result.content[0]?.text).toContain('(Request ID: req-1234)');
  });

  it('maps ToolResponseError object to safe CallToolResult', () => {
    const errorObj = {
      code: 'TOOL_EXECUTION_ERROR',
      message: 'Failed to compute transitive dependencies',
      retryable: true,
    };

    const result = McpErrorMapper.toCallToolResult(errorObj, 'req-5678');

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('[Error TOOL_EXECUTION_ERROR]');
    expect(result.content[0]?.text).toContain('Failed to compute transitive dependencies');
    expect(result.content[0]?.text).toContain('(Request ID: req-5678)');
  });

  it('redacts sensitive secrets if leaked in error messages', () => {
    const sensitiveError = new Error('Database connection failed with key AKIAIOSFODNN7EXAMPLE');
    const result = McpErrorMapper.toCallToolResult(sensitiveError);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(result.content[0]?.text).toContain('[REDACTED_AWS_KEY]');
  });

  it('maps errors to standard and application JSON-RPC error codes', () => {
    const notFound = new ToolNotFoundError('Missing', {}, 'req-1');
    const rpcNotFound = McpErrorMapper.toJsonRpcError(notFound);
    expect(rpcNotFound.code).toBe(McpErrorCodes.TOOL_NOT_FOUND);

    const argErr = new ToolArgumentError('Bad param', {}, 'req-2');
    const rpcArg = McpErrorMapper.toJsonRpcError(argErr);
    expect(rpcArg.code).toBe(McpErrorCodes.INVALID_PARAMS);

    const scopeErr = new ToolScopeError('Scope mismatch', {}, 'req-3');
    const rpcScope = McpErrorMapper.toJsonRpcError(scopeErr);
    expect(rpcScope.code).toBe(McpErrorCodes.SCOPE_VIOLATION);

    const mcpErr = new McpError('Session expired', McpErrorCodes.SESSION_EXPIRED);
    const rpcMcp = McpErrorMapper.toJsonRpcError(mcpErr);
    expect(rpcMcp.code).toBe(McpErrorCodes.SESSION_EXPIRED);

    const genericErr = new Error('Unexpected DB timeout');
    const rpcGeneric = McpErrorMapper.toJsonRpcError(genericErr);
    expect(rpcGeneric.code).toBe(McpErrorCodes.INTERNAL_ERROR);
  });
});
