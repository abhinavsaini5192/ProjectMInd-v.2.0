# MCP Configuration Reference

This document outlines configuration options and environment variables for the ProjectMind MCP Server.

---

## 1. ProjectMind Config Schema

The following fields can be specified in your `projectmind.config.json` file:

```json
{
  "mcpEnabled": true,
  "mcpServerName": "projectmind-mcp-server",
  "mcpServerVersion": "1.0.0",
  "mcpMaxPayloadBytes": 524288,
  "mcpRequestTimeoutMs": 15000,
  "mcpSessionTimeoutMs": 1800000
}
```

### Options Description

| Key | Type | Default | Description |
|---|---|---|---|
| `mcpEnabled` | `boolean` | `true` | Enables or disables the MCP subsystem. |
| `mcpServerName` | `string` | `"projectmind-mcp-server"` | Reported server name in MCP handshake. |
| `mcpServerVersion` | `string` | `"1.0.0"` | Reported server version in MCP handshake. |
| `mcpMaxPayloadBytes` | `number` | `524288` (512 KB) | Maximum allowable payload size for tool requests and responses. |
| `mcpRequestTimeoutMs` | `number` | `15000` (15s) | Request execution timeout before aborting. |
| `mcpSessionTimeoutMs` | `number` | `1800000` (30m) | Inactivity duration before connection session expires. |

---

## 2. Environment Variables

The server CLI accepts configuration via environment variables:

| Variable | Description |
|---|---|
| `PROJECTMIND_WORKSPACE_ID` | Default workspace path or ID (falls back to current directory). |
| `PROJECTMIND_REPOSITORY_ID` | Default repository identifier (falls back to `"default-repo"`). |
| `PROJECTMIND_MCP_MAX_PAYLOAD` | Override for maximum payload bytes. |
| `PROJECTMIND_MCP_TIMEOUT_MS` | Override for request timeout. |

---

## 3. Dependency Injection Configuration

To wire the MCP Server programmatically:

```typescript
import { createProjectMindMcpServer } from './integrations/mcp/di/McpDISetup.js';

const server = createProjectMindMcpServer({
  pipeline,
  workspaceId: '/path/to/project',
  repositoryId: 'project-core',
  maxPayloadBytes: 1024 * 1024,
});

await server.start();
```
