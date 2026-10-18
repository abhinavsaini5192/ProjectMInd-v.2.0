# Failure Recovery & Dead-Letter Handling

## 1. Overview

In production, worker processes may crash abruptly (OOM kills, VM preemptions, power outages) or become deadlocked. Phase 8.6 establishes active lease tracking and background sweepers to detect stranded jobs, recover in-flight work safely, and isolate poison messages into a dedicated Dead-Letter Queue (DLQ).

```
       ┌────────────────────────┐
       │     Active Worker      │
       │  Processing Job J-202  │
       └───────────┬────────────┘
                   │
           Worker Crashes 💥
                   │
                   ▼
       ┌────────────────────────┐
       │   JobLeaseManager      │
       │  Lease expires after   │
       │  leaseDurationMs       │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │   JobRecoveryManager   │
       │  Periodic Recovery     │
       │  Sweep (every 30s)     │
       └───────────┬────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
  Under Max Retries?    Exhausted / Corrupted?
        │                     │
        ▼                     ▼
  Re-queue Job          Route to Dead-Letter
  with incremented      Queue (DLQ) with
  retryCount            diagnostic metadata
```

---

## 2. Lease Management (`IJobLeaseManager`)

To prevent multiple workers from executing the same job concurrently while ensuring recovery if a worker dies, Phase 8.6 utilizes cooperative leases (`src/jobs/recovery/JobLeaseManager.ts`):

```typescript
export interface IJobLeaseManager {
  acquire(jobId: string, workerId: string, durationMs?: number): Promise<boolean>;
  renew(jobId: string, workerId: string, durationMs?: number): Promise<boolean>;
  release(jobId: string, workerId: string): Promise<void>;
  isExpired(jobId: string): Promise<boolean>;
  getExpiredJobs(): Promise<string[]>;
}
```

### Lease Lifecycle
1. **Acquire**: Worker acquires a time-bounded lease (default 60 seconds) upon dequeuing.
2. **Heartbeat / Renew**: While the job handler is executing, the worker pool periodically renews the lease.
3. **Release**: On normal completion or handled failure, the worker explicitly releases the lease.
4. **Expiration**: If the worker dies, heartbeats stop. After `durationMs` has elapsed, the lease is considered expired.

---

## 3. Crash Recovery (`JobRecoveryManager`)

The `JobRecoveryManager` runs as an asynchronous background sweeper (`src/jobs/recovery/JobRecoveryManager.ts`):

### Recovery Workflow
1. **Identify Stale Jobs**: The sweeper queries `JobRepository` for jobs in `RUNNING` status whose leases in `JobLeaseManager` have expired.
2. **Exhaustion Check**:
   - If `retryCount < maxRetries`:
     - Increments `retryCount`.
     - Transitions status from `RUNNING` to `RETRY_PENDING` then `QUEUED`.
     - Re-enqueues message with backoff delay.
   - If `retryCount >= maxRetries`:
     - Transitions status to `DEAD_LETTERED`.
     - Moves record to the Dead-Letter Queue.
3. **Metrics & Alerting**: Emits `jobs_recovered_total` and `jobs_dead_lettered_total` telemetry counters.

---

## 4. Dead-Letter Queue (`IDeadLetterQueue`)

Messages that cannot be successfully processed are never silently discarded. They are routed to `DeadLetterQueue` (`src/jobs/recovery/DeadLetterQueue.ts`):

### 4.1. Conditions for Dead-Lettering
- **Exhausted Retries**: Exceeded `maxRetries` following retryable failures.
- **Non-Retryable Errors**: Validation rejections, unknown job types, malformed payload schemas.
- **Permanent Authorization Failures**: Revoked or invalid workspace permissions.
- **Poison Messages**: Payloads causing deterministic crashes or unhandled exceptions.

### 4.2. Dead-Letter Record Structure
```typescript
export interface DeadLetterRecord {
  deadLetterId: string;
  jobId: string;
  jobType: JobType;
  workspaceId: string;
  repositoryId?: string;
  failureReason: string;
  errorCode: JobErrorCode;
  retryCount: number;
  deadLetteredAt: Date;
  correlationId?: string;
  originalPayloadRef?: string;
  workerId?: string;
}
```

### 4.3. Inspection & Replay
Administrators and operations engineers can inspect and replay DLQ messages:
- `dlq.inspect({ workspaceId, jobType })`: Lists quarantined messages.
- `dlq.replay(jobId)`: Re-enqueues the job into the main queue with a clean retry counter for re-processing once bug fixes or downstream issues are resolved.
- `dlq.purge(olderThan)`: Cleans up obsolete dead-letter records according to data retention policies.
