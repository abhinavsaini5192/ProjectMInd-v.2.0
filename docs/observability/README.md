# ProjectMind Observability & Operations Platform (Phase 8.5)

The **ProjectMind Observability & Operations Platform** provides an AI-native, production-grade, provider-neutral telemetry and operational foundation. It enables end-to-end visibility into ProjectMind's distributed execution pipelines—spanning API gateways, security audit boundaries, context orchestration, knowledge updates, agent runtimes, verification suites, and persistent storage—without coupling domain logic to any telemetry vendor.

---

## 1. Core Architecture

The platform cleanly decouples application domains from telemetry collectors through canonical interfaces and ambient propagation:

```
 Application & Pipeline Layers
  (API, Security, Context, Knowledge, Agent, Verification, Storage)
                            │
                            ▼
              Ambient Correlation Context
           (requestId, correlationId, traceId, spanId)
                            │
                            ▼
           Canonical Observability Interfaces
  ├── ILogger              (Structured, Centralized Redaction)
  ├── IMetricsRegistry     (Counters, Gauges, Histograms with Cardinality Bounding)
  ├── ITracer              (Distributed Spans, Parent/Child, Exception Capture)
  ├── IHealthManager       (Liveness, Readiness, Critical vs Optional Dependencies)
  ├── IDiagnosticManager   (Sanitized Operational Diagnostics & Snapshots)
  ├── IAlertManager        (Condition Policies, Cooldowns, Lifecycle)
  └── OperationalEventBus  (Domain-Independent Lifecycle Events on IEventBus)
                            │
                            ▼
        Telemetry Failure Isolation & Buffers
        (Bounded Queues, Circuit Breakers, Error Catching)
                            │
                            ▼
            Provider-Neutral Telemetry Layer
        (JSON Console, Memory Buffers, Future Exporters)
```

---

## 2. Key Observability Principles

1. **Vendor Neutrality:** Domain code depends strictly on abstract interfaces (`ILogger`, `IMetricsRegistry`, `ITracer`, `IHealthManager`, `IAlertManager`). No vendor-specific libraries (e.g., Prometheus client, OpenTelemetry, Datadog SDK) are imported into business logic.
2. **Zero Duplicate Infrastructure:** Observability reuses the canonical `IEventBus`, Node `AsyncLocalStorage`, and existing `PlatformConfig` rather than spinning up parallel logging or event channels.
3. **Strict Privacy & Secret Sanitization:** Credentials, bearer tokens, API keys, private keys, authorization headers, cookies, repository source code, and raw user prompts are scrubbed at the centralized `LogSanitizer` before reaching any sink.
4. **Telemetry Failure Isolation:** Telemetry failures (network timeouts, disk saturation, exporter crashes) must never interrupt or fail user requests or agent runs. All sinks execute behind circuit breakers and bounded queues.
5. **Strict Cardinality Protection:** Arbitrary user queries, file paths, repository URLs, or stack trace texts are strictly disallowed as metric labels to prevent memory exhaustion.

---

## 3. Telemetry Subsystems Overview

| Subsystem | Primary Interface / Class | Key Responsibilities | Documentation |
|---|---|---|---|
| **Logging** | `ObservabilityLogger`, `LogSanitizer` | Canonical `LogEvent` model, level filtering, ambient correlation, centralized redaction. | [LOGGING.md](./LOGGING.md) |
| **Metrics** | `IMetricsRegistry`, `MetricsRegistry` | Counters, Gauges, Histograms with p50/p90/p95/p99 percentiles and cardinality bounds. | [METRICS.md](./METRICS.md) |
| **Tracing** | `ITracer`, `ISpan`, `TraceSampler` | Distributed spans, parent-child trees, attribute scrubbing, exception events. | [TRACING.md](./TRACING.md) |
| **Health** | `IHealthManager`, `HealthManager` | Liveness, readiness, degraded status, critical vs optional dependency isolation. | [HEALTH.md](./HEALTH.md) |
| **Diagnostics** | `IDiagnosticManager`, `DiagnosticManager` | Operational issues, remediation hints, sanitized diagnostic snapshots. | [DIAGNOSTICS.md](./DIAGNOSTICS.md) |
| **Alerting** | `IAlertManager`, `AlertManager` | Configurable alert policies, alert deduplication, cooldowns, status transitions. | [ALERTING.md](./ALERTING.md) |
| **Operations** | `OperationalEventBus` | Lifecycle events (`SERVICE_STARTED`, `DEPENDENCY_FAILED`, etc.) on `IEventBus`. | [OPERATIONS.md](./OPERATIONS.md) |
| **Security** | `SecurityTelemetry` | Integrates with Phase 8.2 audit logs to track authentication failures and denials. | [SECURITY.md](./SECURITY.md) |
| **Isolation** | `BoundedTelemetryQueue`, `TelemetryCircuitBreaker` | Drop-oldest / drop-newest queues, circuit breaker protection against exporter failure. | [OPERATIONS.md](./OPERATIONS.md) |

---

## 4. Documentation Index

- [LOGGING.md](./LOGGING.md) — Canonical log events, log levels, formatting, and redaction rules.
- [METRICS.md](./METRICS.md) — Metric types, core metric catalog, cardinality bounding, and histograms.
- [TRACING.md](./TRACING.md) — Distributed trace spans, context propagation, error recording, and sampling.
- [HEALTH.md](./HEALTH.md) — Liveness, readiness, critical vs. optional dependencies, and degraded mode.
- [DIAGNOSTICS.md](./DIAGNOSTICS.md) — Diagnostic categories, remediation hints, and operational snapshot generation.
- [ALERTING.md](./ALERTING.md) — Alert definitions, lifecycle, policy evaluation, and event bus integration.
- [SECURITY.md](./SECURITY.md) — Security observability, audit separation, and credential redaction.
- [OPERATIONS.md](./OPERATIONS.md) — Machine-readable operational dashboard, failure isolation, and troubleshooting.
