# Concurrency Control & Optimistic Versioning (Phase 8.4)

## Overview
ProjectMind utilizes **optimistic concurrency control** rather than global pessimistic database locks to maintain consistency across distributed or parallel mutations. Mutable domain entities track an explicit integer `version`.

---

## Conflict Detection

When a client or agent attempts to mutate an entity, it specifies the `expectedVersion`:
```typescript
interface OptimisticVersionedEntity {
  readonly id: string;
  readonly entityType: string;
  readonly version: number;
}
```

```
Client Read (version: 17)
       │
Client Update Request (expectedVersion: 17)
       ▼
Persistence Check:
   Is actualVersion (18) === expectedVersion (17)?
       ├── NO  ─► Throws VersionConflictError (CONCURRENT_MODIFICATION)
       └── YES ─► Atomically update entity, set version = 18
```

---

## Conflict Handling & Retry Backoff

When a `VersionConflictError` occurs, the application service can use `executeWithRetry` to re-fetch the latest state, re-apply the domain delta, and attempt persistence again:

```typescript
const updated = await lockManager.executeWithRetry(async () => {
  const current = await featureRepo.get(featureId);
  const nextVersion = await lockManager.incrementVersion(
    'Feature',
    featureId,
    current.version
  );
  return await featureRepo.save({ ...current, version: nextVersion });
}, {
  maxRetries: 3,
  backoffMs: 50,
  maxBackoffMs: 1000
});
```

### Non-Retryable Errors
- Fatal schema violations, foreign key failures, and permission errors do not trigger retry backoff; they fail fast immediately.
