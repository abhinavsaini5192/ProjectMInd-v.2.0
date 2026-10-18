# Concurrency Model & Operation Policies

## 1. Operation Classification

Operations across ProjectMind are categorized into 5 distinct concurrency classes based on their state-mutation characteristics:

| Operation Class | Characteristics | Locking Required | Concurrency Strategy | Examples |
| :--- | :--- | :--- | :--- | :--- |
| `READ_ONLY` | Pure retrieval; no side-effects. Safe for unbounded parallel execution. | No | Concurrent Reads / Coalesced Cache | Feature queries, symbol lookup, context read. |
| `IDEMPOTENT_WRITE` | Applying the same payload multiple times produces the identical result. | Scoped optional | Deduplication key + Optimistic Version Check | Knowledge observation ingest, telemetry flush. |
| `MUTATING_WRITE` | State changes that alter entity version. Stale writes cause corruption. | Scoped lock where needed | Optimistic Concurrency Token + Atomic CAS | Feature mapping edit, task status update, tag add. |
| `EXCLUSIVE_WRITE` | Destructive or structural mutations that cannot execute concurrently with anything else on that scope. | Exclusive lock | ResourceLockManager with bounded TTL | Schema migration, repository rename, bulk database purge. |
| `LONG_RUNNING` | Background analyses taking seconds or minutes where underlying state may evolve mid-flight. | No | Stale Result Detection (Input Version vs Current Version) | Feature dependency graph analysis, full codebase impact analysis. |

---

## 2. Policy Matrix

Defined in `src/concurrency/models/ConcurrencyPolicy.ts`:

```typescript
export const DEFAULT_CONCURRENCY_POLICIES: Record<string, ConcurrencyPolicy> = {
  featureRead: {
    operationClass: 'READ_ONLY',
    maxConcurrency: 100,
    lockRequired: false,
  },
  contextGenerate: {
    operationClass: 'READ_ONLY',
    maxConcurrency: 20,
    lockRequired: false,
    staleResultProtection: true,
  },
  knowledgeUpdate: {
    operationClass: 'IDEMPOTENT_WRITE',
    maxConcurrency: 5,
    lockRequired: true,
    lockScope: 'REPOSITORY',
    timeoutMs: 30000,
    retryableOnConflict: true,
  },
  featureMappingUpdate: {
    operationClass: 'MUTATING_WRITE',
    lockRequired: true,
    lockScope: 'FEATURE',
    timeoutMs: 15000,
    retryableOnConflict: true,
  },
  schemaMigration: {
    operationClass: 'EXCLUSIVE_WRITE',
    maxConcurrency: 1,
    lockRequired: true,
    lockScope: 'WORKSPACE',
    timeoutMs: 120000,
    retryableOnConflict: false,
  },
  longRunningAnalysis: {
    operationClass: 'LONG_RUNNING',
    maxConcurrency: 3,
    lockRequired: false,
    staleResultProtection: true,
    timeoutMs: 180000,
  },
};
```

---

## 3. Decision Tree for New Operations

When exposing a new API, worker job, or domain service:

```
                      Is operation mutating state?
                                   │
                      ┌────────────┴────────────┐
                      ▼ No                      ▼ Yes
                 [READ_ONLY]         Is mutation idempotent?
                      │                         │
             Use Coalescer / Cache      ┌───────┴───────┐
                                        ▼ Yes           ▼ No
                                [IDEMPOTENT_WRITE]  Is operation structural
                                        │           (migration / rename)?
                                  Check version         │
                                        │          ┌────┴────┐
                                        │          ▼ Yes     ▼ No
                                        │    [EXCLUSIVE] [MUTATING_WRITE]
                                        │         │              │
                                        │    Acquire Lock   Optimistic CAS
                                        ▼         ▼              ▼
                                     Commit      Commit        Commit
```
