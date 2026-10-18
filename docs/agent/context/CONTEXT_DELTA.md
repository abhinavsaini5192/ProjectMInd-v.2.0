# Context Deltas & Safety

## 1. Overview

Sending the entire context package repeatedly over network transports (like MCP or HTTP) is inefficient and consumes unnecessary prompt tokens. ProjectMind provides **Context Deltas** to allow agents to receive:

> *"Only these 3 resources changed, 1 was added, and unchanged items remain valid."*

## 2. ContextDelta Schema

```typescript
export interface ContextDelta {
  readonly deltaId: string;
  readonly contextSessionId: string;
  readonly baseContextVersion: number;
  readonly targetContextVersion: number;
  readonly added: readonly ContextDeltaItem[];
  readonly removed: readonly ContextDeltaItem[];
  readonly changed: readonly ContextDeltaItem[];
  readonly stale: readonly ContextDeltaItem[];
  readonly unchanged: readonly ContextDeltaItem[];
  readonly reason: ContextRefreshReason;
  readonly createdAt: Date;
}
```

## 3. Delta Safety & Conflict Rejection

Applying a delta onto an incorrect base version can lead to corrupted agent memory. ProjectMind enforces strict delta validation rules:

1. **Version Match**: If `delta.baseContextVersion !== currentVersion`, the operation is aborted with `CONTEXT_VERSION_CONFLICT`.
2. **Version Monotonicity**: `delta.targetContextVersion` must be strictly greater than `delta.baseContextVersion`.
3. **Repository Scope**: The delta must belong to the exact repository ID of the active session. If there is any scope mismatch, `CONTEXT_DELTA_INVALID` is thrown.
4. **Fallback**: If an agent receives a version conflict error, it simply requests a full context via `projectmind_get_current_context({ includeDelta: false })`.
