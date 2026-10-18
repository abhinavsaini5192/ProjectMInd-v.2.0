# Session Lifecycle & Boundaries

## 1. Session Model

An `AgentSession` is a secure, scoped container representing an ongoing working relationship between an external AI coding agent and a specific workspace and repository.

Key attributes:
- `sessionId`: Globally unique identifier.
- `agentId`: Unique external agent registration identifier.
- `workspaceId`: Tenant workspace identifier.
- `repositoryId`: Repository scope.
- `capabilities`: Agent capability set negotiated during handshake.
- `status`: `ACTIVE`, `IDLE`, `TERMINATED`, `EXPIRED`.

## 2. Capacity & Timeout Constraints

1. **Max Concurrent Sessions**: Configured via `AgentRuntimeLimits.maxConcurrentSessions` (default: 10, configurable). Exceeding this limit throws `RuntimeCapacityError`.
2. **Session TTL**: Sessions time out after inactivity (`sessionTimeoutMs`, default 1 hour).
3. **Workspace Isolation**: When accessing a session, `workspaceId` and `repositoryId` are validated. Mismatches throw `RuntimeScopeError`.
