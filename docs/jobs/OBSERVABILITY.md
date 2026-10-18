# Background Job Observability & Telemetry

## 1. Overview

Phase 8.6 integrates seamlessly with the Phase 8.5 Observability & Operations Platform. Every background job lifecycle transition—from dispatch and queue wait through worker execution and completion or failure—is instrumented with structured logs, Prometheus-compatible metrics, and distributed trace spans.

```
       Job Dispatcher                      Job Queue                       Worker & Handler
      ┌───────────────┐               ┌────────────────┐               ┌────────────────────────┐
      │ Span:         │               │                │               │ Span:                  │
      │ "job.dispatch"│──[ Enqueue ]─►│ Queue Wait     │──[ Dequeue ]─►│ "job.execute"          │
      └───────────────┘               │ (Track Latency)│               │                        │
             │                        └────────────────┘               │ - Execute Service Call │
             ▼                                                         │ - Record Duration      │
       Metric:                                                         └────────────────────────┘
       jobs_enqueued_total                                                         │
                                                                                   ▼
                                                                       Metrics:
                                                                       jobs_completed_total
                                                                       jobs_failed_total
                                                                       job_execution_duration_ms
```

---

## 2. Core Metrics

All job metrics are registered with the Phase 8.5 `IMetricsRegistry` via `JobTelemetry` (`src/jobs/observability/JobTelemetry.ts`):

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `jobs_enqueued_total` | Counter | `job_type`, `priority`, `workspace_id` | Total background jobs accepted and enqueued. |
| `jobs_completed_total` | Counter | `job_type`, `workspace_id` | Total jobs successfully executed to completion. |
| `jobs_failed_total` | Counter | `job_type`, `error_code`, `retryable` | Total job execution failures. |
| `jobs_retried_total` | Counter | `job_type`, `attempt` | Total retry attempts triggered due to transient errors. |
| `jobs_dead_lettered_total` | Counter | `job_type`, `error_code` | Total jobs routed to the Dead-Letter Queue. |
| `job_execution_duration_ms` | Histogram | `job_type`, `status` | Time spent executing inside the job handler. |
| `job_queue_wait_duration_ms` | Histogram | `job_type`, `priority` | Latency between enqueue timestamp and dequeue start. |
| `job_queue_depth` | Gauge | `priority` | Current count of pending messages in the queue. |
| `worker_pool_active_workers` | Gauge | `pool_id` | Number of workers currently in `BUSY` state. |
| `worker_pool_capacity` | Gauge | `pool_id` | Total configured worker capacity. |

---

## 3. Distributed Tracing

Asynchronous operations maintain trace continuity across process and network boundaries using OpenTelemetry-compatible trace context:

1. **Context Injection at Ingestion**:
   - `JobDispatcher` captures the active trace context (`traceId`, `spanId`) and stores it in the `Job` record and `QueueMessage`.
2. **Context Extraction at Worker**:
   - Upon dequeuing, `Worker` extracts the trace context and starts a child span: `job.execute`.
3. **Span Hierarchy**:
   ```
   [Span] api.request (POST /api/v1/jobs)
     └── [Span] job.dispatch (KnowledgeUpdateJob)
           └── [Span] job.queue_wait (Latency in queue: 45ms)
                 └── [Span] job.execute (KnowledgeUpdateJobHandler)
                       ├── [Span] knowledge_coordinator.update
                       └── [Span] context_orchestrator.invalidate
   ```

---

## 4. Structured Logging & Secret Sanitization

All log events emitted during job processing include standard correlation metadata:
- `job_id`: Unique identifier of the job.
- `job_type`: Canonical job category.
- `workspace_id`: Tenant workspace boundary.
- `correlation_id`: Cross-cutting transaction identifier.
- `trace_id`: Distributed trace identifier.
- `worker_id`: Identifier of the worker executing the task.

### Sanitization Guarantee
Job payloads and arguments are strictly sanitized before logging. Any field name containing sensitive tokens (`password`, `token`, `secret`, `apiKey`, `bearer`) is replaced with `[REDACTED]` to prevent credential leakage in log aggregation systems.
