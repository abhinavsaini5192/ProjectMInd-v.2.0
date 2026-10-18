# ProjectMind Agent Tool Protocol (Phase 7.2)

## 1. Executive Summary

The **ProjectMind Agent Tool Protocol** defines the canonical, provider-neutral semantic interface through which external AI coding agents (and human pair-programmers) query project intelligence and report execution progress.

The protocol decouples agent implementations (such as Claude Code, Cursor, Codex, Gemini, or custom IDE agents) from ProjectMind's internal graph representations, feature discovery engines, and context optimizers.

---

## 2. Core Protocol Architecture

```
+-------------------------------------------------------------+
|                     AI Coding Agent                         |
+-------------------------------------------------------------+
                              |
                              | ToolRequest (Protocol 1.0)
                              v
+-------------------------------------------------------------+
|                   AgentToolPipeline                         |
|  1. Request Envelope Validation (ToolRequestValidator)       |
|  2. Safety Validation (ToolSafetyValidator)                 |
|  3. Registry Lookup (IAgentToolRegistry)                    |
|  4. Scope & Context Checking (Workspace / Session)          |
|  5. Capability Verification (AgentCapabilityResolver)       |
|  6. Schema Type Checking (ToolSchemaValidator)              |
|  7. Idempotency Check (ToolIdempotencyManager)              |
|  8. Handler Invocation (IAgentToolHandler + Timeout)        |
|  9. Secret Sanitization (SecuritySanitizer.redactSecrets)   |
| 10. Envelope Packaging (ToolResponse)                       |
+-------------------------------------------------------------+
                              |
          +-------------------+-------------------+
          |                                       |
          v                                       v
+-------------------------+             +-------------------+
|  IContextOrchestrator   |             | FeatureKnowledge  |
|  (Context & Prompting)  |             | (Feature Memory)  |
+-------------------------+             +-------------------+
```

---

## 3. Invocation Envelope (`ToolRequest`)

Every tool execution must adhere to the canonical `ToolRequest` envelope:

```typescript
interface ToolRequest {
  readonly requestId: string;            // Unique client-generated correlation ID
  readonly sessionId?: string;           // Optional working session ID (required for REPORT_ONLY)
  readonly agentId: string;              // Registered agent identity
  readonly protocolVersion: string;      // Must be "1.0"
  readonly toolName: string;             // Canonical name (e.g., projectmind_get_context)
  readonly arguments: Record<string, unknown>; // Validated against ToolInputSchema
  readonly workspaceId: string;          // Target workspace boundary
  readonly repositoryId: string;         // Target repository identifier
  readonly timestamp: string;            // ISO-8601 creation timestamp
  readonly metadata?: Record<string, unknown>; // Optional execution hints (e.g., timeoutMs)
}
```

---

## 4. Response Envelope (`ToolResponse`)

Every execution returns a deterministic, structured envelope:

```typescript
interface ToolResponse {
  readonly requestId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly result?: unknown;
  readonly warnings: readonly string[];
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
    readonly details?: unknown;
  };
  readonly metadata: {
    readonly durationMs: number;
    readonly timestamp: string;
    readonly protocolVersion: string;
    readonly cached?: boolean;
  };
  readonly protocolVersion: string;
  readonly timestamp: string;
}
```

---

## 5. Protocol Error Codes

| Error Code | HTTP Equiv | Description | Retryable |
|:---|:---|:---|:---|
| `TOOL_NOT_FOUND` | 404 | Tool name is not registered in ProjectMind | No |
| `TOOL_DISABLED` | 403 | Tool is temporarily disabled by configuration | No |
| `TOOL_VERSION_UNSUPPORTED`| 400 | Client protocol version is unsupported | No |
| `TOOL_ARGUMENT_INVALID` | 400 | Input arguments fail schema or security validation | No |
| `TOOL_CAPABILITY_DENIED` | 403 | Agent or session lacks required capability | No |
| `TOOL_SCOPE_DENIED` | 403 | Request workspace/session mismatch or missing session | No |
| `TOOL_PAYLOAD_TOO_LARGE` | 413 | Argument or result size exceeds configured limits | No |
| `TOOL_TIMEOUT` | 504 | Handler execution exceeded maximum execution time | Yes |
| `TOOL_STALE_DATA` | 409 | Requested data fails freshness policy | Yes |
| `TOOL_UNAVAILABLE` | 503 | Underlying subsystem or handler unavailable | Yes |
| `TOOL_EXECUTION_FAILED` | 500 | Unhandled internal error during execution | Yes |
| `TOOL_PROTOCOL_ERROR` | 400 | Malformed request envelope or invalid structure | No |
