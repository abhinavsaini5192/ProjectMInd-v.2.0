# ProjectMind Background Jobs & Event Processing Platform (Phase 8.6)

The **ProjectMind Background Jobs & Event Processing Platform** provides a provider-neutral, durable, observable, and failure-isolated asynchronous execution architecture for ProjectMind. It enables safe background execution for resource-intensive and decoupled operations—such as knowledge graph updates, context refreshes, feature intelligence analysis, verification suites, and storage maintenance—without duplicating core domain logic or tying ProjectMind to proprietary cloud queues.

---

## 1. Core Principles & Non-Negotiables

1. **Execution Wrapper, Not Business Logic:**
   A background job worker is an execution and concurrency coordinator. It delegates directly to existing canonical application and domain services (`IKnowledgeUpdateCoordinator`, `IContextOrchestrator`, etc.). Workers never redefine domain intelligence or query databases with ad-hoc logic.
2. **Canonical EventBus Remains Sole Transport:**
   Event-to-job dispatch listens on the existing `IEventBus` via `EventJobRouter`. No parallel event transports or "Job EventBuses" are created.
3. **At-Least-Once Delivery & Mandatory Idempotency:**
   Queue delivery semantics are `AT_LEAST_ONCE`. Every job handler and dispatch operation is strictly idempotent, utilizing `jobId` and `idempotencyKey` combined with `workspaceId`.
4. **Strict Isolation & Privacy Invariants:**
   Job execution preserves tenant and repository boundaries. Cross-workspace execution is denied. Secret keys, credentials, and tokens are prohibited from job payloads.
5. **No Shell Commands or Autonomous Agents:**
   Workers execute strictly registered typed handlers. They do not execute arbitrary shell commands or turn ProjectMind into an unconstrained autonomous coding loop.

---

## 2. System Architecture

```
 Event / API / Trigger
           │
           ▼
    EventJobRouter / JobDispatcher
           │
           ├── Idempotency & Scope Check
           ├── Job Persistence (IJobRepository)
           │
           ▼
      IJobQueue (Priority Queue with Backpressure)
           │
           ▼
      WorkerPool / Worker
           │
           ├── Lease Acquisition (IJobLeaseManager)
           ├── Cooperative Cancellation (AbortSignal) & Timeout
           │
           ▼
      IJobHandler<T>
           │
           ▼
  Canonical Domain Services
  (KnowledgeUpdateCoordinator, ContextOrchestrator, etc.)
           │
           ├── Result / Progress Reporting
           ├── Retry with Exponential Backoff + Jitter
           └── Dead-Letter Queue (IDeadLetterQueue)
```

---

## 3. Subsystem Overview

| Component | Primary Interface / Class | Responsibilities | Documentation |
|---|---|---|---|
| **Models** | `Job`, `JobStatus`, `JobPriority` | 12 deterministic states, 4 priority levels, structured progress, and typed errors. | [JOB_LIFECYCLE.md](./JOB_LIFECYCLE.md) |
| **Queue** | `IJobQueue`, `InMemoryJobQueue` | Priority ordering (`CRITICAL` to `LOW`), visibility timeouts, backpressure limits. | [QUEUES.md](./QUEUES.md) |
| **Workers** | `IWorker`, `Worker`, `WorkerPool` | Execution coordination, timeout races, cooperative cancellation, pool concurrency limits. | [WORKERS.md](./WORKERS.md) |
| **Registry** | `IJobRegistry`, `JobRegistry` | Typed job-to-handler mapping with duplicate registration rejection. | [JOB_ARCHITECTURE.md](./JOB_ARCHITECTURE.md) |
| **Dispatcher** | `IJobDispatcher`, `EventJobRouter` | Idempotent dispatching, event-to-job translation from canonical `IEventBus`. | [JOB_ARCHITECTURE.md](./JOB_ARCHITECTURE.md) |
| **Retries** | `RetryPolicy`, `BackoffStrategy` | Retryable vs non-retryable classification, exponential backoff with full jitter. | [RETRIES.md](./RETRIES.md) |
| **Recovery** | `IJobLeaseManager`, `JobRecoveryManager` | Worker crash detection, lease expiration, orphaned job requeuing or dead-lettering. | [FAILURE_RECOVERY.md](./FAILURE_RECOVERY.md) |
| **Dead-Letter** | `IDeadLetterQueue`, `DeadLetterQueue` | Permanent preservation of failed jobs with reason, retry count, and correlation ID. | [FAILURE_RECOVERY.md](./FAILURE_RECOVERY.md) |
| **Scheduling** | `IScheduler`, `JobScheduler` | Single delayed execution and recurring maintenance task scheduling. | [SCHEDULING.md](./SCHEDULING.md) |
| **Security** | `JobAuthorizationValidator` | Workspace boundary enforcement, scope validation, secret payload rejection. | [SECURITY.md](./SECURITY.md) |
| **Observability** | `JobTelemetry` | Telemetry integration with Phase 8.5 metrics, structured logging, and tracing. | [OBSERVABILITY.md](./OBSERVABILITY.md) |

---

## 4. Documentation Index

- [JOB_ARCHITECTURE.md](./JOB_ARCHITECTURE.md) — Architecture, interfaces, handler registry, and dispatch flow.
- [JOB_LIFECYCLE.md](./JOB_LIFECYCLE.md) — 12 deterministic states, state machine rules, and progress tracking.
- [QUEUES.md](./QUEUES.md) — Queue contracts, priority sorting, visibility timeouts, and backpressure.
- [WORKERS.md](./WORKERS.md) — Worker model, worker pools, concurrency limits, and graceful shutdown.
- [RETRIES.md](./RETRIES.md) — Retry classification, exponential backoff with jitter, and max limits.
- [FAILURE_RECOVERY.md](./FAILURE_RECOVERY.md) — Worker crash recovery, lease management, and dead-letter queues.
- [SECURITY.md](./SECURITY.md) — Multi-tenant workspace isolation, authorization, and secret rejection.
- [OBSERVABILITY.md](./OBSERVABILITY.md) — Metrics, distributed tracing spans, and correlation context.
- [SCHEDULING.md](./SCHEDULING.md) — Single and recurring schedules, interval timers, and maintenance tasks.
