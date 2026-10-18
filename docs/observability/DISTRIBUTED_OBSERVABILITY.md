# ProjectMind — Distributed Observability & Diagnostics Guide (Phase 10.6)

## 1. Overview & Architecture Map

Phase 10.6 introduces a unified, production-oriented distributed observability system for ProjectMind. The architecture links HTTP API instances, background workers, persistent event processors, SQLite storage engines, and deployment environments into a single coherent telemetry fabric:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Incoming HTTP Request                   │
                  │    Headers: x-correlation-id, traceparent (W3C)         │
                  └───────────────────────────┬─────────────────────────────┘
                                              │
                                              ▼
                             ┌─────────────────────────────────┐
                             │      CorrelationMiddleware      │
                             │  Validates & stores in          │
                             │  AsyncLocalStorage context      │
                             └────────────────┬────────────────┘
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
            ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
            │  Structured Log  │    │  MetricsRegistry │    │  Tracer / Spans  │
            │  (LogSanitizer,  │    │  (Counters,      │    │  (W3C Hex IDs,   │
            │   CWE-117 escape)│    │   Gauges, Hist)  │    │   OTLP Exporter) │
            └──────────────────┘    └──────────────────┘    └──────────────────┘
                      │                       │                       │
                      ▼                       ▼                       ▼
            ┌──────────────────────────────────────────────────────────────────┐
            │                     Asynchronous Boundaries                      │
            │   • SqliteJobRepository: persists correlationId & traceId        │
            │   • Worker.ts: restores ambient context across job execution     │
            │   • OutboxDispatcher.ts: restores causationId & eventId          │
            │   • InboxProcessor.ts: tracks deduplication & consumer lag       │
            └──────────────────────────────────────────────────────────────────┘
```

---

## 2. Structured Logging Schema

Logs in ProjectMind follow a strict canonical schema emitted as machine-readable JSON in production, with human-readable formatting in development.

### Canonical Log Fields:
- `eventId`: Unique UUIDv4 identifier for the log event.
- `timestamp`: ISO-8601 UTC timestamp.
- `level`: `DEBUG` | `INFO` | `WARN` | `ERROR` | `FATAL`.
- `service`: Service name (default: `projectmind`).
- `component`: Specific subsystem (e.g., `worker-engine`, `sqlite-storage`, `api`).
- `operation`: Action being executed (e.g., `process_job`, `acquire_lock`).
- `instanceId`: Runtime instance identifier (e.g., container ID or hostname).
- `role`: Process role (`api`, `worker`, `scheduler`, `tool`).
- `correlationId`: Logical correlation identifier propagating across services.
- `causationId`: The parent job or event ID that caused this action.
- `traceId`: W3C 32-hex trace identifier.
- `spanId`: W3C 16-hex span identifier.
- `jobId`: Durable job identifier (when applicable).
- `attemptNumber`: Worker attempt retry index.
- `aggregateId`: Aggregate ID for domain events.
- `workspaceId`: Workspace scope identifier.
- `errorClassification`: Standardized operational classification (e.g., `DEPENDENCY_OUTAGE`).
- `metadata`: Sanitized, bounded metadata object.

### Security & CWE-117 Injection Protection
- **Secret Redaction:** High-entropy tokens (OpenAI, Anthropic, GitHub PAT, Slack, AWS keys, JWTs) and embedded URI credentials are automatically redacted with `[REDACTED]`.
- **CWE-117 Log Injection Mitigation:** Carriage returns (`\r`) and newlines (`\n`) are escaped as literal `\\r` and `\\n` to prevent attacker-controlled multiline log forgery.

---

## 3. Distributed Correlation & Context Propagation

Context is managed transparently via Node.js `AsyncLocalStorage` (`CorrelationContext`), ensuring full isolation between concurrent requests without memory leaks or race conditions:

1. **Incoming Requests:** `CorrelationMiddleware` inspects `x-correlation-id` and W3C `traceparent`. If missing, cryptographically secure IDs are generated.
2. **Job Scheduling:** When a job is submitted via `SqliteJobRepository`, the ambient `correlationId` and `traceId` are automatically stored in SQLite.
3. **Worker Execution:** `Worker.ts` retrieves the job metadata and initializes a child `CorrelationContext.run(...)` with `role: 'worker'`, `jobId`, `attemptNumber`, and `causationId: parentJobId ?? jobId`.
4. **Outbox Events:** `OutboxDispatcher.ts` and `InboxProcessor.ts` similarly restore ambient correlation contexts for all persistent event processing.

---

## 4. Metrics & Instrumentation

Metrics are collected with bounded cardinality to prevent memory exhaustion and Prometheus scrape degradation:

- **HTTP Requests:** `projectmind_requests_total`, `projectmind_active_connections`, `projectmind_active_requests`.
- **Database & Storage:** `projectmind_sqlite_wal_bytes`, `projectmind_storage_operations_total`, `projectmind_storage_duration_ms`.
- **Distributed Coordination:** `projectmind_lock_acquisitions_total`, `projectmind_lock_acquisition_failures_total`, `projectmind_lock_acquisition_duration_ms`.
- **Job Processing:** `projectmind_job_queue_depth`, `projectmind_jobs_processed_total`, `projectmind_jobs_dead_lettered_total`, `projectmind_job_duration_ms`.
- **Event Outbox / Inbox:** `projectmind_outbox_dispatched_total`, `projectmind_outbox_failed_total`, `projectmind_inbox_processed_total`.
- **Runtime & Memory:** `projectmind_process_memory_rss_bytes`, `projectmind_process_memory_heap_used_bytes`, `projectmind_uptime_ms`.

Exposition endpoints are available at `/metrics` (Prometheus text format) and `/v1/metrics` (JSON format).

---

## 5. Distributed Tracing & OpenTelemetry OTLP

Traces follow the W3C TraceContext specification:
- **Header:** `traceparent: 00-{traceId}-{spanId}-{flags}`
- **Validation:** Disallows invalid lengths, non-hex characters, version `ff`, all-zero trace IDs, and all-zero span IDs.
- **Exporters:**
  - `InMemoryTraceExporter`: Used for deterministic testing and local inspection.
  - `NoopTraceExporter`: Zero-overhead mode for local CLI commands.
  - `OtlpHttpTraceExporter`: Standard OpenTelemetry Protocol over HTTP (`/v1/traces`), featuring bounded queueing (default 2,000 spans), timeout isolation, and graceful shutdown.

---

## 6. Truthful Health & Readiness Diagnostics

ProjectMind strictly separates liveness from readiness to prevent destructive restart loops during transient dependency issues:

| Endpoint | Probe Type | Behavior |
| :--- | :--- | :--- |
| `/health/live` | **Liveness** | Verifies process execution and event loop health. Returns HTTP 200 while process runs. |
| `/health/ready` | **Readiness** | Checks actual connectivity to required dependencies (SQLite WAL check, queue access). Drops to **HTTP 503** if a required dependency is down or during graceful draining (`SERVER_DRAIN`). |
| `/health` | **Component Health** | Comprehensive report of all registered subsystems (`KERNEL`, `STORAGE_SQLITE`, `EVENT_BUS`, `JOBS`, `PLUGINS`). |

---

## 7. Diagnostic CLI & Operational Commands

Two primary diagnostic commands are provided:

### `projectmind health [--json] [--verbose]`
Performs live inspection of storage integrity (SQLite WAL quick check), queue depths, dead-letter backlog, and active plugins. Returns exit code `0` on healthy, `1` on failure.

### `projectmind doctor [--json]`
Runs 11 environment and integrity checks:
1. Workspace initialization
2. SQLite Database Integrity & WAL mode
3. Schema Migrations applied
4. Queue depth & Dead-letter backlog
5. Plugin runtime health
6. Observability and telemetry status
7. Snapshot storage integrity
8. Node.js version & memory consumption
9. Secret key configuration
10. Workspace resolution
11. Canonical project scope

---

## 8. Measured Performance Benchmarks

Measured under vitest microbenchmark test suite (`tests/observability/performance.test.ts`):
- **Logging Throughput:** ~155,000 ops/sec (64ms for 10,000 structured events).
- **Metrics Recording:** ~0.5 microseconds per operation (24ms for 50,000 operations).
- **Trace Span Lifecycle:** ~8 microseconds per span (40ms for 5,000 spans).
- **Health Aggregation:** ~0.4ms across 10 component checks.
