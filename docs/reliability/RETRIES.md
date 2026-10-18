# ProjectMind Retry Coordination & Policy

ProjectMind enforces bounded, observable, and policy-driven retries. Rather than applying blind retry loops universally, retries are restricted to operations classified as retryable.

## 1. Core Retry Rules

1. **Never Retry Non-Retryable Categories**:
   - `AUTHORIZATION`: Authorization/permission failures will never succeed on replay.
   - `VALIDATION`: Malformed requests remain malformed.
   - `DATA_INTEGRITY`: Corrupted state cannot be corrected by re-executing.
   - `CONFIGURATION`: Misconfigurations require operational correction.
   - `PERMANENT`: Known fatal bugs must not cause retry loops.

2. **Always Bound Retries**:
   - Every retry policy enforces a maximum attempt count (default: 3 attempts).
   - Infinite retries are strictly prohibited in all platform components.

3. **Exponential Backoff with Full Jitter**:
   - Backoff delay formula: `min(maxDelayMs, baseDelayMs * 2^(attempt - 1) + jitter)`.
   - Prevents retry stampedes across worker pools when recovering from dependency blips.

4. **Preserve Idempotency**:
   - Only idempotent mutations (or operations bearing an `idempotencyKey`) may be retried.
   - Replayed operations must guarantee identical outcome without duplicate mutations.

## 2. Integration with Phase 8.6 Job Engine

In Phase 8.6, the Background Job engine implemented the `JobRetryPolicy`:
- Max attempts: Configured per job definition.
- Dead Letter Queue (`DEAD_LETTER` state): Triggered automatically when max retry attempts are exhausted or when an error is classified as non-retryable.
- Backoff computation: Exponential with jitter.

The Phase 8.8 `FailureClassifier.isRetryable(error)` feeds directly into job dispatch and worker execution to decide between immediate dead-lettering and scheduled retry.
