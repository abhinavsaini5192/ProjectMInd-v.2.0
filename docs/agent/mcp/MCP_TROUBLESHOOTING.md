# MCP Troubleshooting & Diagnostics Guide

This guide covers common integration issues, error codes, and troubleshooting steps for the ProjectMind MCP Server.

---

## 1. Error Codes Reference

| Error Code | Name | Meaning | Resolution |
|---|---|---|---|
| `-32700` | `PARSE_ERROR` | Malformed JSON-RPC message received. | Check JSON syntax of client request. |
| `-32600` | `INVALID_REQUEST` | Missing JSON-RPC fields (id, method). | Ensure client adheres to JSON-RPC 2.0. |
| `-32601` | `METHOD_NOT_FOUND` | Method not supported (e.g. prompts, resources). | ProjectMind only supports `tools/list`, `tools/call`, `initialize`, and `ping`. |
| `-32602` | `INVALID_PARAMS` | Missing required parameters or path traversal. | Validate arguments against tool JSON schema. |
| `-32001` | `SESSION_INVALID` | Session ID does not exist. | Re-run initialization or check session ID. |
| `-32002` | `SESSION_EXPIRED` | Inactivity timeout reached. | Reconnect or increase `mcpSessionTimeoutMs`. |
| `-32003` | `SCOPE_VIOLATION` | Attempted access to different workspace/repo. | Ensure client workspaceId matches server scope. |
| `-32004` | `PAYLOAD_TOO_LARGE` | Request or response exceeds byte threshold. | Increase `mcpMaxPayloadBytes` or paginate. |
| `-32005` | `SERVER_DRAINING` | Server is shutting down. | Retry after server completes restart. |
| `-32006` | `TOOL_NOT_FOUND` | Requested tool name not recognized. | Check tool name against `tools/list`. |

---

## 2. Common Issues & Solutions

### A. Client says "No tools found"
- **Cause**: Server did not complete initialization handshake, or tool registry was empty.
- **Fix**: Verify server output: `server.getHealth()` should show `toolCount: 12`.

### B. "Tool with name '...' requires either 'featureId' or non-empty 'modifiedFiles'"
- **Cause**: Tool argument validation failed.
- **Fix**: Review required arguments in `MCP_TOOL_MAPPING.md`.

### C. Connection hangs or times out in Claude Desktop / Cursor
- **Cause**: Debug logs were printed to `process.stdout`, corrupting JSON-RPC transport stream.
- **Fix**: Never print plain text to `stdout` in an stdio MCP server! Use `stderr` for logging (`console.error`), or use ProjectMind StructuredLogger.
