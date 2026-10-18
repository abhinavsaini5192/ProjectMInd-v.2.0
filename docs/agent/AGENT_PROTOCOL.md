# Agent Integration Protocol (Version 1.0)

## 1. Protocol Overview

The ProjectMind Agent Protocol is a canonical, JSON-serializable request/response envelope standard for all interactions between external AI coding agents and ProjectMind.

Supported protocol versions:
- `1.0` (Current: `CURRENT_AGENT_PROTOCOL_VERSION = '1.0'`)

---

## 2. Request Envelope

All agent operations must arrive wrapped in the `AgentRequest<TPayload>` envelope:

```typescript
export interface AgentRequest<TPayload = unknown> {
  readonly requestId: string;
  readonly protocolVersion: string; // e.g. '1.0'
  readonly operation: AgentOperationType;
  readonly agentId: string;
  readonly sessionId?: string | undefined;
  readonly workspaceContext: AgentWorkspaceContext;
  readonly payload: TPayload;
  readonly timestamp: string;
  readonly clientInfo?: AgentEnvironment | undefined;
  readonly traceId?: string | undefined;
}
```

### Mandatory Fields:
- `requestId`: Unique invocation identifier for tracing and idempotency.
- `protocolVersion`: Must match a supported version (currently `'1.0'`).
- `operation`: One of 12 supported operations.
- `agentId`: Registered agent identifier.
- `workspaceContext`: Scoped boundary containing non-empty `workspaceId` and `repositoryId`.

---

## 3. Response Envelope

All agent operations produce a deterministic `AgentResponse<TData>` envelope:

```typescript
export interface AgentResponse<TData = unknown> {
  readonly requestId: string;
  readonly status: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  readonly data?: TData | undefined;
  readonly error?: AgentResponseError | undefined;
  readonly metadata: AgentResponseMetadata;
}

export interface AgentResponseMetadata {
  readonly durationMs: number;
  readonly timestamp: string;
  readonly protocolVersion: string;
  readonly traceId?: string | undefined;
  readonly tokensUsed?: number | undefined;
  readonly cacheHit?: boolean | undefined;
}
```

---

## 4. Supported Operations

| Operation Type | Required Capability | Minimum Trust Level | Purpose |
|:---|:---|:---|:---|
| `GET_CONTEXT` | `CONTEXT_REQUEST` | `UNTRUSTED` | Retrieve model-adapted context packages |
| `GET_FEATURE` | `FEATURE_QUERY` | `UNTRUSTED` | Retrieve feature profile and metadata |
| `GET_FEATURE_CONTEXT` | `TASK_CONTEXT` | `LIMITED` | Retrieve context specialized for feature tasks |
| `GET_IMPACT` | `IMPACT_QUERY` | `LIMITED` | Analyze change impact propagation & risks |
| `GET_ARCHITECTURE` | `ARCHITECTURE_QUERY` | `LIMITED` | Query architectural components & patterns |
| `GET_HISTORY` | `HISTORY_QUERY` | `LIMITED` | Retrieve feature evolution history |
| `GET_HEALTH` | `HEALTH_QUERY` | `LIMITED` | Retrieve feature health scores and risks |
| `EXPLAIN_CONTEXT` | `CONTEXT_EXPLANATION` | `UNTRUSTED` | Explain why resources were included/excluded |
| `REFRESH_CONTEXT` | `CONTEXT_REFRESH` | `TRUSTED` | Invalidate cache and fetch current context |
| `REPORT_EXECUTION` | `EXECUTION_REPORT` | `TRUSTED` | Log executed modifications and changed files |
| `REPORT_VERIFICATION` | `VERIFICATION_REPORT` | `TRUSTED` | Log test results and verification status |
| `UPDATE_KNOWLEDGE` | `KNOWLEDGE_UPDATE` | `SYSTEM` | Ingest validated knowledge into memory |

---

## 5. Standard Error Codes

| Error Code | Class | Description |
|:---|:---|:---|
| `AGENT_NOT_FOUND` | `AgentNotFoundError` | Target agent ID is not registered |
| `AGENT_SESSION_NOT_FOUND` | `AgentSessionNotFoundError` | Session does not exist or has expired |
| `AGENT_UNSUPPORTED_CAPABILITY` | `AgentCapabilityError` | Agent or session lacks required capability |
| `AGENT_SCOPE_VIOLATION` | `AgentScopeError` | Request outside session workspace/repo or trust level |
| `AGENT_OPERATION_ERROR` | `AgentOperationError` | Operation failed during handler execution |
| `AGENT_PROTOCOL_ERROR` | `AgentProtocolError` | Protocol payload structure violation |
| `AGENT_VALIDATION_ERROR` | `AgentValidationError` | Field validation or schema constraint failure |
| `AGENT_VERSION_MISMATCH` | `AgentVersionError` | Requested protocol version is not supported |
| `AGENT_TIMEOUT` | `AgentTimeoutError` | Operation exceeded deadline |
| `AGENT_CONFLICT` | `AgentConflictError` | Agent already registered with active state |
