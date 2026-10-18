# Optimistic Concurrency & Versioning

## 1. Overview

Optimistic concurrency is ProjectMind's primary defense against lost updates and data corruption. Instead of locking records during reads, mutations supply an expected version number. If another concurrent process modified the record in the interim, the update is rejected with `VersionConflictError`.

---

## 2. Version Tokens (`ConcurrencyToken`)

Rather than exposing database primary keys or internal timestamps, clients receive and submit stable `ConcurrencyToken` objects:

```typescript
export interface ConcurrencyToken {
  readonly resourceId: string;
  readonly version: number;
  readonly generatedAt: number;
  readonly source: string;
}
```

---

## 3. Atomic Compare-And-Increment

Implemented in `src/storage/consistency/OptimisticLockManager.ts`:

```typescript
public async incrementVersion(
  entityType: string,
  entityId: string,
  expectedVersion: number
): Promise<number> {
  const key = this.makeKey(entityType, entityId);
  const actualVersion = this.entityVersions.get(key);

  if (actualVersion !== undefined && actualVersion !== expectedVersion) {
    throw new VersionConflictError(entityType, entityId, expectedVersion, actualVersion);
  }

  const newVersion = expectedVersion + 1;
  this.registerVersion(entityType, entityId, newVersion);
  return newVersion;
}
```

### Atomicity Invariant
The version check and registration execute in the same synchronous turn of the event loop, ensuring zero microtask gap during concurrent requests.

---

## 4. Automatic Retry Loop

Transient version conflicts (e.g. concurrent tag additions or metric ticks) can be retried automatically using `executeWithRetry`:

```typescript
await optimisticManager.executeWithRetry(async () => {
  const current = optimisticManager.getVersion('Task', taskId) ?? 1;
  // Apply domain modification
  return optimisticManager.incrementVersion('Task', taskId, current);
}, { maxRetries: 3, backoffMs: 50 });
```
