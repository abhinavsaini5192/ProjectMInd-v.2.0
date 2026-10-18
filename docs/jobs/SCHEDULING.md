# Background Job Scheduling & Recurring Maintenance

## 1. Overview

Phase 8.6 includes a lightweight, provider-neutral scheduling abstraction (`IScheduler` and `JobScheduler` in `src/jobs/scheduling/`). It manages delayed one-off executions and recurring operational maintenance tasks without introducing a bloated cron replacement or duplicating existing schedulers.

```
       ┌────────────────────────┐
       │     JobScheduler       │
       │                        │
       │  ┌──────────────────┐  │
       │  │ Delayed Schedule │──┼─► [Delay Timer] ──► Dispatcher.dispatch()
       │  └──────────────────┘  │
       │  ┌──────────────────┐  │
       │  │ Recurring Interval│──┼─► [Interval Tick] ──► Dispatcher.dispatch()
       │  └──────────────────┘  │
       └────────────────────────┘
```

---

## 2. Core Interface: `IScheduler`

Defined in `src/jobs/scheduling/IScheduler.ts`:

```typescript
export interface IScheduler {
  scheduleOnce(request: CreateJobRequest, runAt: Date): Promise<string>;
  scheduleRecurring(
    scheduleId: string,
    request: CreateJobRequest,
    intervalMs: number,
  ): Promise<string>;
  cancel(scheduleId: string): Promise<boolean>;
  getSchedules(): ScheduledTask[];
  start(): void;
  stop(): void;
}
```

---

## 3. Recurring Maintenance Operations

ProjectMind relies on recurring background tasks for system health, storage hygiene, and context optimization:

| Job Type | Recommended Interval | Canonical Delegate Service | Description |
| :--- | :--- | :--- | :--- |
| `INTEGRITY_CHECK` | Every 6 hours | `PersistenceIntegrityChecker` | Validates hash integrity and foreign key relations across stores. |
| `DATA_LIFECYCLE` | Daily (24 hours) | `RetentionPolicyManager` | Prunes tombstoned records and archives expired snapshots (Phase 8.4). |
| `CONTEXT_INVALIDATION` | Every 30 minutes | `ContextOrchestrator` | Identifies stale context packages whose source files have been modified. |
| `MAINTENANCE` | Every 1 hour | `OperationalMaintenanceService` | Purges expired DLQ records and releases abandoned leases. |

---

## 4. Scheduling Invariants & Safety

To prevent resource runaway and duplicate work:

1. **Stable Schedule Identity**: Recurring schedules require explicit `scheduleId` values (e.g., `sched_daily_retention_sweep`), ensuring that bootstrap re-registrations overwrite existing definitions rather than creating duplicate schedules.
2. **Overlap Protection (Single-Flight Invariant)**: If a recurring task is still actively `RUNNING` in the worker pool when its next schedule interval arrives, the scheduler skips that tick to avoid thundering-herd pileups on slow operations.
3. **Graceful Shutdown**: Calling `scheduler.stop()` immediately clears all active `setTimeout` and `setInterval` handles, allowing clean process termination without hung event loop references.
4. **Authorization Inheritance**: Scheduled jobs must supply an explicit `JobSecurityContext` with system or service credentials. They never run as anonymous or unauthenticated principals.
