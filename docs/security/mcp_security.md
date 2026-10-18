# ProjectMind Model Context Protocol (MCP) Security (Phase 8.9)

## 1. Canonical Security Integration

MCP clients (e.g. Claude Desktop, Cursor IDE MCP) connect to ProjectMind tools via the JSON-RPC Model Context Protocol.

MCP clients do **not** receive special bypasses. Every MCP tool call is governed by:
- Canonical identity authentication.
- Scope containment validation.
- RBAC permission checks via `ToolSecurityAuthorizer`.
- Parameter secret sanitization via `LogRedactor`.

## 2. Tool Authorization Mapping

| MCP Tool Name | Action | Resource Type | Required Technical Capability |
| :--- | :--- | :--- | :--- |
| `projectmind_get_context` | `READ` | `CONTEXT` | `READ_CONTEXT` |
| `projectmind_get_feature` | `READ` | `FEATURE` | `READ_CONTEXT` |
| `projectmind_get_impact` | `READ` | `KNOWLEDGE` | `READ_CONTEXT` |
| `projectmind_report_execution` | `REPORT` | `OBSERVATION` | `REPORT_EXECUTION` |
| `projectmind_report_verification` | `REPORT` | `VERIFICATION` | `REPORT_VERIFICATION` |
| `projectmind_update_knowledge` | `UPDATE` | `KNOWLEDGE` | `UPDATE_KNOWLEDGE` |
| `projectmind_refresh_context` | `REFRESH` | `CONTEXT` | `REFRESH_CONTEXT` |

## 3. Parameter Sanitization & Isolation

- **Secret Redaction**: Any credentials, tokens, or private keys mistakenly passed in tool arguments are sanitized pre-execution by `ToolSecurityAuthorizer.sanitizeToolParameters`.
- **Cross-Scope Protection**: If an MCP caller passes a `workspaceId` outside its authorized scope, the call is blocked immediately.
