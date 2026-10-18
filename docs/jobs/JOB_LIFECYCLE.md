# Job Lifecycle & State Transitions (Phase 8.6)

ProjectMind defines 12 deterministic states for background jobs. Transitions are strictly validated to prevent invalid skips or mutations of finished jobs.

---

## 1. Lifecycle State Machine

```
               ┌──────────┐
               │ CREATED  │
               └────┬─────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   ┌───────────┐         ┌───────────┐
   │ SCHEDULED │────────>│  QUEUED   │
   └───────────┘         └─────┬─────┘
                               │
                               ▼
                         ┌───────────┐
            ┌───────────>│  RUNNING  │<────────────┐
            │            └─────┬─────┘             │
            │                  │                   │
            │        ┌─────────┼─────────┐         │
            │        ▼         ▼         ▼         │
            │  ┌──────────┐┌─────────┐┌──────────┐ │
            │  │TIMED_OUT ││ FAILED  ││  PAUSED  │─┘
            │  └─────┬────┘└────┬────┘└──────────┘
            │        │          │
            │        └────┬─────┘
            │             ▼
            │     ┌───────────────┐
            └─────┤ RETRY_PENDING │
                  └───────┬───────┘
                          │ (Max retries exhausted)
                          ▼
                  ┌───────────────┐
                  │ DEAD_LETTERED │  (Terminal)
                  └───────────────┘

   Successful path:
   RUNNING ──────────────> COMPLETED (Terminal)

   Cancellation:
   CREATED / SCHEDULED / QUEUED / RUNNING ──> CANCELLED (Terminal)
```

---

## 2. Valid Transitions Table

| State | Permitted Next States | Description |
|---|---|---|
| `CREATED` | `QUEUED`, `SCHEDULED`, `CANCELLED` | Job instantiated and persisted. |
| `SCHEDULED` | `QUEUED`, `CANCELLED` | Job waiting for `scheduledAt` timestamp to arrive. |
| `QUEUED` | `RUNNING`, `CANCELLED` | Job present in queue, waiting for an available worker. |
| `RUNNING` | `COMPLETED`, `FAILED`, `RETRY_PENDING`, `TIMED_OUT`, `CANCELLED`, `PAUSED` | Actively executing on an assigned worker with an active lease. |
| `PAUSED` | `RUNNING`, `CANCELLED` | Execution paused for operational throttling or dependency wait. |
| `RETRY_PENDING`| `QUEUED`, `DEAD_LETTERED`, `CANCELLED` | Transient failure occurred; waiting for backoff delay before re-queue. |
| `FAILED` | `DEAD_LETTERED`, `RETRY_PENDING` | Handler threw error or failed execution. |
| `TIMED_OUT` | `DEAD_LETTERED`, `RETRY_PENDING`, `FAILED` | Execution exceeded configured `timeoutMs`. |
| `COMPLETED` | *(None - Terminal)* | Successfully finished and result recorded. |
| `CANCELLED` | *(None - Terminal)* | Explicitly cancelled by operator or timeout. |
| `DEAD_LETTERED`| *(None - Terminal)* | Permanent failure or retries exhausted; routed to DLQ. |

---

## 3. Progress Tracking

Long-running jobs report non-blocking progress updates via `context.updateProgress()`:

```typescript
export interface JobProgress {
  readonly completed: number;     // e.g. 50
  readonly total: number;         // e.g. 100
  readonly percentage: number;    // e.g. 50 (bounded 0 to 100)
  readonly message?: string;      // e.g. 'Processing chunk 5 of 10'
  readonly updatedAt: string;     // ISO timestamp
}
```

> **Invariant:** Progress reporting is informational and monitored by API clients. It is never treated as proof of job completion without the worker verifying handler resolution.
