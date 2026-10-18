# Transaction Management (Phase 8.4)

## Overview
ProjectMind establishes explicit transaction boundaries to guarantee ACID consistency across domain mutations. Transactions are controlled exclusively by application services and unit-of-work coordinators—never by HTTP controllers or presentation layers.

---

## Transaction Lifecycle & States

```
                ┌──────────────┐
                │    ACTIVE    │
                └──────┬───────┘
          ┌────────────┼────────────┐
          │ commit()   │ rollback() │ timeout
          ▼            ▼            ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │ COMMITTED │ │ROLLED_BACK│ │ TIMED_OUT │
   └───────────┘ └───────────┘ └───────────┘
```

- **ACTIVE**: Transaction is open, tracking operations, savepoints, and mutations.
- **COMMITTED**: All operations committed successfully to persistent storage. Further commits/rollbacks throw `StorageCoreError`.
- **ROLLED_BACK**: Changes discarded cleanly due to failure, manual rollback, or savepoint unwind.
- **TIMED_OUT**: Elapsed execution exceeded `timeoutMs`; automatic rollback is triggered to release storage locks.
- **FAILED**: Exception occurred during physical commit/rollback execution.

---

## Key Capabilities

### 1. Programmatic Scoping (`runInTransaction`)
The recommended pattern wraps units of work within `runInTransaction`:
```typescript
const result = await transactionManager.runInTransaction(async (tx) => {
  // Related persistence operations
  await featureStore.save(feature);
  await auditStore.saveEvent(auditEvent);
  return feature.id;
}, { name: 'update_feature_and_audit', timeoutMs: 5000 });
```
- If the block completes normally, `tx.commit()` is called automatically.
- If an uncaught exception is thrown, `tx.rollback()` is invoked automatically before re-throwing the error.

### 2. Nested Savepoints
When sub-operations may fail without invalidating the entire parent transaction, savepoints allow partial unwinding:
```typescript
const tx = await transactionManager.beginTransaction();
await tx.createSavepoint('checkpoint_alpha');

try {
  await riskySubOperation();
} catch (err) {
  // Rollback only the sub-operation changes
  await tx.rollbackToSavepoint('checkpoint_alpha');
}

await tx.commit();
```

### 3. Timeout Protection
To prevent dangling transactions from locking storage indefinitely during long operations, transactions enforce a configurable `timeoutMs`. Upon expiration, the transaction status transitions to `TIMED_OUT` and any commit attempt is rejected.

> [!IMPORTANT]
> Long-running operations such as AI inference, remote LLM streaming, external agent dispatch, or full repository file scans **must never** be executed inside an open transaction boundary.
