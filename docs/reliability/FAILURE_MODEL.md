# ProjectMind Failure Classification Model

The ProjectMind Reliability platform establishes a deterministic, 12-category failure taxonomy. Every operational error is intercepted, classified, and tagged with severity and retryability.

## 1. Canonical Failure Categories

| Category | Description | Retryable | Default Severity | Common Root Causes |
| :--- | :--- | :---: | :---: | :--- |
| `TRANSIENT` | Ephemeral execution glitch | **YES** | `MEDIUM` | Temporary network blip, process pause, brief lock contention |
| `RETRYABLE` | Explicitly marked safe to replay | **YES** | `MEDIUM` | Idempotent background job timeout, message requeue |
| `PERMANENT` | Static failure that will not succeed on retry | **NO** | `HIGH` | Bug in query logic, unimplemented protocol method |
| `DEPENDENCY` | External service or store failure | **YES** | `HIGH` | Postgres connection drop, Redis down, Qdrant unavailable |
| `TIMEOUT` | Operation deadline exceeded | **YES** | `HIGH` | Slow network call, heavy query beyond deadline |
| `CONCURRENCY` | Optimistic lock or lease conflict | **YES** | `MEDIUM` | Version conflict, concurrent update race, lock contention |
| `AUTHORIZATION` | Security or scope denial | **NO** | `CRITICAL` | Invalid bearer token, missing workspace access, expired role |
| `VALIDATION` | Malformed or invalid input | **NO** | `MEDIUM` | Payload missing required field, bad JSON, negative duration |
| `DATA_INTEGRITY`| Corrupted data or checksum mismatch | **NO** | `CRITICAL` | Bit rot in storage snapshot, corrupted state payload |
| `RESOURCE_EXHAUSTION` | Saturation or quota limit | **YES** | `CRITICAL` | Out of memory (OOM), queue backpressure, HTTP 429 rate limit |
| `CONFIGURATION` | Invalid environment setup or migration | **NO** | `CRITICAL` | Missing DB connection string, failed database schema migration |
| `UNKNOWN` | Unclassified runtime error | **NO** | `MEDIUM` | Unhandled runtime exception |

## 2. Severity Levels

1. `CRITICAL`: Immediate threat to platform integrity, security, or core storage availability. Requires operator intervention or fail-safe stop.
2. `HIGH`: Dependency outage or timeout impacting user requests or background jobs. Trips circuit breakers.
3. `MEDIUM`: Isolated validation or retryable concurrency conflict.
4. `LOW`: Non-blocking warning or informational runtime discrepancy.

## 3. Classification Pipeline

The `FailureClassifier` processes errors through prioritized pattern matching:
1. **Strongly Typed Job Errors**: Inspects `JobError.code` (e.g., `STORAGE_UNAVAILABLE`, `JOB_AUTHORIZATION_FAILED`).
2. **Version Conflicts**: Identifies `VersionConflictError` and attaches expected vs actual versions.
3. **Stale Results**: Identifies `StaleComputationError` and marks non-retryable to force cache/data refresh.
4. **Keyword Pattern Evaluation**: Evaluates stack traces and error messages for known systemic patterns (e.g., `deadlock`, `ECONNREFUSED`, `checksum mismatch`).
5. **Fallback**: Generates structured `FailureRecord` with an immutable UUID, correlation ID, and timestamp.
