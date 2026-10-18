# MCP Server Lifecycle & Operations Guide

This guide describes the server state machine, startup and shutdown sequences, request draining, and telemetry operations.

---

## 1. Lifecycle State Machine

```
   [ STOPPED ] ──start()──► [ STARTING ] ──► [ RUNNING ]
        ▲                                          │
        │                                          │ stop()
        │                                          ▼
   [ STOPPING ] ◄───────── [ DRAINING ] ◄──────────┘
        │
   (on unrecoverable error) ──► [ FAILED ]
```

### State Definitions:
- **`STOPPED`**: Initial state; no transports connected, no incoming traffic accepted.
- **`STARTING`**: Initializing sessions, binding handlers to MCP SDK, connecting transports.
- **`RUNNING`**: Active, accepting `tools/list` and `tools/call` requests.
- **`DRAINING`**: Server shutdown initiated. New requests are rejected with `SERVER_DRAINING` (-32005). Active in-flight requests are allowed to complete.
- **`STOPPING`**: Active requests finished; closing transports and connections.
- **`FAILED`**: Unrecoverable fatal error occurred.

---

## 2. Request Draining Protocol

When `server.stop()` is called:
1. State transitions to `DRAINING`.
2. Any new incoming tool request throws `McpErrorCodes.SERVER_DRAINING`.
3. The server awaits completion of all `activeRequests` up to a configured `drainTimeoutMs` (default: 5000ms).
4. Once `activeRequests === 0` (or timeout expires), the transport stream is closed cleanly and session resources are released.

---

## 3. Operational Health & Diagnostics

The `McpHealthService` monitors the server state:

```typescript
const health = await server.getHealth();
```

Returns:
- `status`: `'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'`
- `state`: Current lifecycle state (`'RUNNING'`, `'DRAINING'`, etc.)
- `uptimeSeconds`: Seconds since server started
- `activeRequests`: Current in-flight request count
- `totalRequests`: Total requests handled
- `toolCount`: Number of registered tools (12)
