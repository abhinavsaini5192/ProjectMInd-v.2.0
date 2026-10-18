# Observability, Logging & Telemetry

## 1. Structured Logging

ProjectMind emits structured JSON log entries conforming to `ILogger`:
- `timestamp`: ISO-8601 UTC timestamp.
- `service`: Application service name (`projectmind`).
- `version`: Application release version.
- `env`: Environment mode.
- `severity`: `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`.
- `component`: Subsystem emitting the log.
- `operation`: Specific action being executed.
- `correlationId` / `requestId`: Request correlation tracing identifiers.
- `message`: Human-readable summary.
- `durationMs`: Execution time (if applicable).
- `details`: Metadata payload.

## 2. Pre-Log Secret Redaction

The `LogRedactor` sanitizes all entries and header dictionaries before emission. The following keys and patterns are automatically replaced with `[REDACTED]`:
- Passwords, secret keys, API keys, tokens, bearer headers, authorization credentials.
- Connection strings containing embedded credentials (e.g. `postgres://user:pass@host`).

## 3. Metrics & Bounded Dimensions

The `PlatformMetricsCollector` records counters, gauges, and timers:
- Counters: `platform_startups_total`, `platform_shutdowns_total`, `context_requests_total`, `tool_executions_total`.
- Gauges: `runtime_sessions_active`, `runtime_tasks_active`.
- Timers: `platform_startup_duration`, `platform_shutdown_duration`, `context_request_duration`, `tool_execution_duration`.
- Bounded Dimensions: Prompts, user queries, and file paths are excluded from metric label keys to prevent memory leaks from high-cardinality values.
