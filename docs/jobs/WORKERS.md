# Worker & Worker Pool Architecture

## 1. Overview

Workers in Phase 8.6 are execution wrappers around canonical ProjectMind application services. They manage the lifecycle of message dequeuing, lease renewal, timeout management, error classification, and state transitions without implementing domain logic directly.

```
       ┌────────────────────────────────────────────────────────┐
       │                      WorkerPool                        │
       │  maxConcurrency: 10                                    │
       │  maxPerWorkspace: 4                                    │
       │                                                        │
       │   Worker 1           Worker 2           Worker N       │
       │  ┌────────────┐     ┌────────────┐     ┌────────────┐  │
       │  │ State: BUSY│     │ State: IDLE│     │ State: IDLE│  │
       │  │ Job: J-101 │     │            │     │            │  │
       │  └─────┬──────┘     └────────────┘     └────────────┘  │
       └────────┼───────────────────────────────────────────────┘
                │
                ▼
        Job Execution Flow
        1. Acquire Lease (Heartbeat)
        2. Resolve Security Context & Authorize
        3. Verify Predecessor Dependencies
        4. Execute Registered Handler with AbortSignal
        5. Record Telemetry (Phase 8.5)
        6. Acknowledge Queue Message
```

---

## 2. Worker Lifecycle & States

Every worker instance (`src/jobs/workers/Worker.ts`) operates according to a strict state machine (`src/jobs/workers/WorkerState.ts`):

```
       STOPPED ────► STARTING ────► IDLE ◄────► BUSY
          ▲                                       │
          │                                       ▼
          └────────── TERMINATING ◄────── DRAINING
```

| State | Description | Behavior |
| :--- | :--- | :--- |
| `STOPPED` | Worker is uninitialized or shut down. | No background loop running. |
| `STARTING` | Initializing resources and registering handlers. | Preparing for dequeue loop. |
| `IDLE` | Polling the queue for available messages. | Sleeps for `pollIntervalMs` if no message is available. |
| `BUSY` | Actively processing a dequeued job. | Lease is renewed periodically; abort timer is active. |
| `DRAINING` | Graceful shutdown initiated. | Rejects new dequeue requests; allows active job to complete. |
| `TERMINATING`| Forcing cleanup and releasing leases. | Cancels in-flight work if drain timeout expires. |

---

## 3. Worker Execution Loop: Step-by-Step

When a worker consumes a `QueueMessage`, it executes the following sequence:

1. **Message Validation**: Confirms message format, non-expired status, and resolves corresponding `Job` record from `IJobRepository`.
2. **Lease Acquisition**: Registers worker heartbeat with `IJobLeaseManager` for the duration of the job timeout.
3. **Dependency Verification**:
   - Inspects `job.parentJobId` and `job.dependencies`.
   - If any predecessor job is not `COMPLETED`, the message is requeued with backoff delay.
4. **Security & Authorization**:
   - Reconstructs `JobSecurityContext` (workspace, repository, actor principal, scopes).
   - Validates that the actor holds permission for the requested `JobType` within the specified workspace.
   - Prevents cross-workspace execution.
5. **Handler Resolution**:
   - Retrieves registered `IJobHandler` from `IJobRegistry`.
   - If unknown, the job immediately fails with code `UNKNOWN_JOB_TYPE` and is routed to Dead-Letter Queue.
6. **Execution with Timeout & Abort Signal**:
   - Constructs `JobExecutionContext` containing an `AbortSignal`, logger, and progress reporter.
   - Races `handler.execute(job, context)` against the job's configured timeout using `AbortController`.
7. **Result Handling & Telemetry**:
   - **Success**: Transitions job to `COMPLETED`, persists `JobResult`, emits telemetry duration metric, acknowledges queue message, releases lease.
   - **Failure**: Catches error, classifies as `RETRYABLE` or `NON_RETRYABLE`, increments retry count, updates job status, and routes to either retry queue or Dead-Letter Queue.

---

## 4. Worker Pool Management (`IWorkerPool`)

The `WorkerPool` (`src/jobs/workers/WorkerPool.ts`) manages worker lifecycle and coordinates concurrency limits:

### 4.1. Concurrency Controls
- **Global Concurrency**: Limits total simultaneous running jobs across the entire process (default: 10 workers).
- **Workspace Concurrency**: Limits maximum concurrent workers allocated to a single workspace (default: 4 workers), preventing single-tenant resource starvation.
- **Job-Type Concurrency**: Configurable limits on heavy operations (e.g., maximum 2 simultaneous `FEATURE_DEPENDENCY_ANALYSIS` jobs).

### 4.2. Graceful Shutdown Protocol
When `pool.stop()` is invoked (e.g., on SIGTERM or application shutdown):
1. **Transition**: All workers enter `DRAINING` state; no new messages are dequeued.
2. **In-Flight Completion**: Workers wait up to `drainTimeoutMs` (default 30 seconds) for in-flight jobs to complete cleanly.
3. **Safe Requeue**: Any interrupted jobs that cannot complete within the drain window are rejected with `requeue: true`, allowing another worker to resume upon restart.
4. **Lease Release**: All held leases are explicitly released.
5. **Telemtry Flush**: Worker pool flushes metrics and logs before entering `STOPPED`.

---

## 5. What Workers MUST NOT Do

To maintain system integrity and security, workers are strictly constrained:
- ❌ **No Domain Business Logic**: Workers do not inspect ASTs, calculate graph metrics, or parse git trees directly. They delegate to canonical domain services (`KnowledgeUpdateCoordinator`, `ContextOrchestrator`, etc.).
- ❌ **No Shell Execution**: Workers never invoke child processes, shell commands, or bash scripts.
- ❌ **No Autonomous Code Edits**: Workers do not modify user repository source files.
- ❌ **No Secret Storage**: Workers do not store or persist raw API keys or passwords.
- ❌ **No Privilege Escalation**: Workers never execute jobs with higher privileges than the originating principal's security context.
