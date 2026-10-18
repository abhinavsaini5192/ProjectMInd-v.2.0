# Retries, Backoff & Error Classification

## 1. Overview

Background jobs in distributed systems inevitably face transient failures (network blips, lock contention, temporary storage unavailability). Phase 8.6 implements a rigorous error classification and backoff mechanism that retries transient issues while immediately failing permanent errors, preventing retry storms and resource exhaustion.

```
       Job Execution Failure
                 │
                 ▼
       Error Classification
        ┌───────────────────────────────────────────────────┐
        │  Is error retryable?                              │
        │  (Transient DB, lock timeout, rate limit, etc.)   │
        └──────────────┬────────────────────┬───────────────┘
                       │ Yes                │ No
                       ▼                    ▼
        ┌────────────────────────┐   ┌───────────────────────────┐
        │ Has retryCount reached │   │ Permanent Failure:        │
        │ maxRetries?            │   │ Status = FAILED           │
        └──────┬──────────┬──────┘   │ Code = INVALID_JOB / etc. │
               │ No       │ Yes      │ Route to DLQ              │
               ▼          ▼          └───────────────────────────┘
     ┌──────────────┐   ┌──────────────┐
     │ Compute      │   │ Exhausted:   │
     │ Backoff with │   │ Status =     │
     │ Full Jitter  │   │ DEAD_LETTERED│
     │ Requeue      │   └──────────────┘
     └──────────────┘
```

---

## 2. Error Classification

Every job failure is categorized into one of two deterministic categories (`src/jobs/models/JobError.ts` and `src/jobs/retry/RetryPolicy.ts`):

### 2.1. Retryable Errors
Failures caused by temporary conditions that are expected to self-resolve on a subsequent attempt:
- **Lock Contention / Concurrency Conflicts**: Storage record locked by another concurrent process.
- **Transient Storage / Network Outages**: Temporary connection drops or timeouts to persistence layers.
- **Downstream Rate Limits (429)**: Throttling by external or internal subsystem endpoints.
- **Queue/Worker Backpressure**: Temporary saturation of worker resources.

### 2.2. Non-Retryable Errors
Failures where retrying is futile and would waste computational resources:
- **Authorization & Permission Denials**: Caller lacks required scopes for the workspace.
- **Validation Errors**: Malformed payloads, missing required parameters, invalid formats.
- **Unknown Job Type**: Job type is not registered in `JobRegistry`.
- **Corrupted / Invalid Schema**: Payloads that cannot be parsed or deserialized.
- **Idempotency Rejections**: Conflicting mutation requests with stale versions.

---

## 3. Backoff Strategies (`src/jobs/retry/BackoffStrategy.ts`)

ProjectMind supports three backoff strategies:

| Strategy | Description | Formula |
| :--- | :--- | :--- |
| `FIXED` | Constant delay between attempts. | $Delay = minDelayMs$ |
| `EXPONENTIAL` | Deterministic exponential scaling. | $Delay = \min(maxDelayMs, minDelayMs \times factor^{attempt})$ |
| `EXPONENTIAL_WITH_JITTER` (Default) | Full Jitter to avoid synchronized thundering herd. | $Delay = \text{random}(0, \min(maxDelayMs, minDelayMs \times factor^{attempt}))$ |

### Why Full Jitter?
When a downstream service recovers from an outage, hundreds of queued jobs would otherwise wake up and retry simultaneously. Full jitter disperses retry requests uniformly across the delay window $[0, Delay]$, smoothing load spikes:

```typescript
export function computeBackoffDelay(
  attempt: number,
  strategy: BackoffStrategy = BackoffStrategy.EXPONENTIAL_WITH_JITTER,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS,
): number {
  const { minDelayMs = 1000, maxDelayMs = 30000, factor = 2 } = options;
  const base = Math.min(maxDelayMs, minDelayMs * Math.pow(factor, attempt));
  
  if (strategy === BackoffStrategy.EXPONENTIAL_WITH_JITTER) {
    return Math.floor(Math.random() * base);
  }
  return base;
}
```

---

## 4. Retry Configuration & Bounded Limits

Default policy limits enforced by `RetryPolicy`:
- `maxRetries`: Default is 3 attempts (configurable per job, upper bound: 10).
- `minDelayMs`: Default is 1,000ms (1 second).
- `maxDelayMs`: Default is 60,000ms (1 minute).
- `factor`: Default exponential factor is 2.

Infinite retries are strictly prohibited. Once `retryCount >= maxRetries`, the job transitions directly to `DEAD_LETTERED` to safeguard worker pool availability.
