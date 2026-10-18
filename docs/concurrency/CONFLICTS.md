# Conflict Resolution & Stale Result Protection

## 1. Conflict Categories & Actions

When concurrency conflicts occur, they are deterministically categorized by `ConflictResolver` (`src/concurrency/consistency/ConflictResolver.ts`):

| Conflict Type | Cause | Default Action | Retryable? | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `VERSION_CONFLICT` | Target version changed concurrently. | `REFRESH` | Yes | Refresh state and re-attempt mutation under `maxRetries`. |
| `RESOURCE_LOCK_CONFLICT` | Exclusive lock actively held. | `RETRY` | Yes | Exponential backoff with full jitter; fails when retries exhausted. |
| `STALE_RESULT` | Long background analysis used older knowledge version than current. | `REFRESH` | No | Stale derived state rejected; analysis must re-run against current version. |
| `DUPLICATE_OPERATION` | Idempotent event or task received a second time. | `IGNORE_DUPLICATE`| No | Safely ignored with successful status; no redundant work done. |
| `SCOPE_CONFLICT` | Attempt to lock or mutate across workspace boundary. | `REJECT` | No | Security violation; immediately rejected without retry. |
| `STATE_TRANSITION_CONFLICT` | Invalid state transition (e.g. `COMPLETED -> RUNNING`). | `REJECT` | No | Deterministic rejection. |
| `DEPENDENCY_CONFLICT` | Predecessor job or feature dependency not met. | `MANUAL_REVIEW` | No | Work deferred or escalated. |

---

## 2. Stale Result Protection

For long-running background tasks (e.g. repository feature discovery, context compilation, impact analysis):

```
       Analysis Starts                     Knowledge Update (Concurrent)
      (Knowledge Version 10)                 (Knowledge Version 10 ──► 11)
              │                                           │
              ▼                                           ▼
       Long Computation                            Committed to DB
         (Duration 30s)
              │
              ▼
       Analysis Finishes
       Derived State: Version 10
              │
              ▼
       StaleResultDetector.assertFresh('repo', 10, getCurrentVersion)
              │
              ▼
       Current Version is 11 > 10
              │
              ▼
       💥 StaleComputationError: REJECTED!
       (Prevents overwriting newer knowledge with stale analysis)
```

The `StaleResultDetector` (`src/concurrency/consistency/StaleResultDetector.ts`) guarantees that derived intelligence is never committed if the underlying repository knowledge evolved while the calculation was in-flight.
