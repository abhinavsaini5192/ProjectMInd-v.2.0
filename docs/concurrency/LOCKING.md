# Resource Locking & Contention Management

## 1. Overview

While optimistic concurrency is preferred across ProjectMind, certain unmergeable or destructive operations require exclusive execution guarantees. The `ResourceLockManager` (`src/concurrency/locking/ResourceLockManager.ts`) provides fine-grained, time-bounded, ownership-validated resource locks.

---

## 2. Lock Key Scoping

Locks must be strictly scoped to avoid coarse-grained bottlenecking. Global workspace locks are strictly prohibited unless executing workspace-wide schema migrations:

```typescript
ResourceLockManager.buildKey(
  workspaceId: string,
  repositoryId?: string,
  scope: string = 'global',
  operation?: string
): string
```

### Scope Examples:
- **Feature Lock**: `ws:mind:repo:core:scope:feature:feat-auth:op:edit`
- **Repository Rename Lock**: `ws:mind:repo:core:scope:admin:op:rename`
- **Workspace Migration Lock**: `ws:mind:scope:migration:op:schema-v1`

---

## 3. Lock Lifecycle & Ownership Validation

```
     acquire(key, ownerId, { ttlMs: 30000 })
                   │
                   ▼
     ┌───────────────────────────┐
     │ Is resource actively      │
     │ locked by another owner?  │
     └─────────────┬─────────────┘
                   │
         ┌─────────┴─────────┐
         ▼ No                ▼ Yes
     [Acquired]      Wait requested (waitTimeoutMs > 0)?
         │                   │
         │           ┌───────┴───────┐
         │           ▼ Yes           ▼ No
         │     Backoff & Poll   [LOCK_CONTENDED]
         │           │
         │     Deadline passed?
         │           │
         │     ┌─────┴─────┐
         │     ▼ Yes       ▼ No (Lock released)
         │  [TIMEOUT]   [Acquired]
         │     │           │
         ▼     ▼           ▼
       Execute Operation
         │
         ▼
     release(lockId, ownerId)
```

### Safety Invariants:
1. **Ownership Validation**: A lock can only be renewed or released by the `ownerId` that originally acquired it. Unauthorized callers receive `false`.
2. **Re-Entrancy**: If the same `ownerId` calls `acquire()` on a resource it already holds, the lock is refreshed with the new TTL rather than causing self-deadlock.
3. **Automatic TTL Expiration**: Every lock has a finite time-to-live (`ttlMs`, default 30s, max 300s). If an owner crashes, the lock expires automatically and is reclaimed on the next access.
