# Queue Architecture & Delivery Semantics

## 1. Overview

Phase 8.6 establishes a provider-neutral, bounded queue abstraction for asynchronous background processing in ProjectMind. The queue subsystem separates job ingestion from worker consumption while maintaining deterministic ordering, backpressure controls, and visibility management.

```
       Job Ingestion (Dispatcher / Router)
                       │
                       ▼
       ┌───────────────────────────────┐
       │       IJobQueue Provider      │
       │  (e.g., InMemoryJobQueue)     │
       │                               │
       │  ┌─────────────────────────┐  │
       │  │  Binary Search Priority │  │
       │  │  Queue Buffer           │  │
       │  └─────────────────────────┘  │
       │  ┌─────────────────────────┐  │
       │  │  Visibility Timeout     │  │
       │  │  Index                  │  │
       │  └─────────────────────────┘  │
       └───────────────────────────────┘
                       │
                       ▼
            Worker Pool Consumption
```

---

## 2. Core Interface: `IJobQueue`

All queue implementations adhere to the provider-neutral `IJobQueue` interface defined in `src/jobs/queue/IJobQueue.ts`:

```typescript
export interface IJobQueue {
  enqueue(message: QueueMessage): Promise<void>;
  dequeue(options?: DequeueOptions): Promise<QueueMessage | null>;
  acknowledge(receiptHandle: string): Promise<void>;
  reject(receiptHandle: string, requeue?: boolean, delayMs?: number): Promise<void>;
  requeue(receiptHandle: string, delayMs?: number): Promise<void>;
  inspect(options?: QueueInspectOptions): Promise<QueueMessage[]>;
  depth(): Promise<number>;
  clear(): Promise<void>;
}
```

### Key Operations

| Operation | Description | Delivery Impact |
| :--- | :--- | :--- |
| `enqueue` | Appends a `QueueMessage` into the queue buffer. Rejects if capacity exceeded (backpressure). | Increases queue depth. |
| `dequeue` | Retrieves the highest priority message whose `availableAt` timestamp has elapsed and sets visibility timeout. | Message becomes invisible to other workers. |
| `acknowledge` | Permanently removes an in-flight message using its unique `receiptHandle`. | Finalizes successful message processing. |
| `reject` | Explicitly rejects a message. If `requeue: true`, resets visibility or applies delay. Otherwise discards. | Used on unrecoverable or retryable errors. |
| `requeue` | Re-inserts message with an optional delay (for exponential backoff retries). | Preserves message for subsequent attempt. |
| `inspect` | Read-only peek into queue messages without altering visibility or dequeue state. | Used for diagnostics and monitoring. |
| `depth` | Returns total pending (non-acknowledged, non-expired) message count. | Key metric for autoscaling and alerting. |

---

## 3. Delivery Semantics: `AT_LEAST_ONCE`

ProjectMind background processing explicitly guarantees **AT_LEAST_ONCE** delivery:

> [!IMPORTANT]
> **Exactly-Once is NOT Claimed**: Distributed environments, process crashes, and worker lease expirations can result in duplicate message deliveries. Therefore, **all job handlers MUST be strictly idempotent**.

### Why At-Least-Once?
1. **Worker Crashes**: If a worker node crashes mid-execution, its visibility timeout expires, and the message returns to the visible queue for another worker to process.
2. **Network Partitions**: Acknowledgements may be lost over network boundaries, causing a retry of an already completed task.
3. **Recovery Sweeper**: Stale jobs are re-queued by the recovery manager if heartbeat/lease renewal ceases.

Handlers enforce idempotency via the canonical storage layer, using `jobId` and `idempotencyKey` checks prior to applying mutations.

---

## 4. `InMemoryJobQueue` Implementation

The reference provider (`src/jobs/queue/InMemoryJobQueue.ts`) provides high-performance, non-blocking local queueing:

### 4.1. Fast Priority Insertion via Binary Search
Rather than calling `Array.prototype.sort()` on every `enqueue()`—which degrades to $O(N^2 \log N)$ under heavy load—the queue uses binary search insertion ($O(N)$ worst-case shift, $O(\log N)$ comparison):
- Sort primary key: `priority` (CRITICAL=4 > HIGH=3 > NORMAL=2 > LOW=1).
- Sort secondary key: `availableAt` / `enqueuedAt` (earlier timestamp has higher precedence).

Measured microbenchmark throughput: **>435,000 operations per second** for 10,000 elements (22.95ms total).

### 4.2. Visibility Timeouts
When a worker dequeues a message:
1. A unique `receiptHandle` is generated (`uuidv4()`).
2. The message is marked as leased until `Date.now() + visibilityTimeoutMs` (default 30 seconds).
3. If not acknowledged within this window, subsequent calls to `dequeue()` make the message visible again.

### 4.3. Backpressure Control
To protect against unbounded memory growth:
- Configurable `maxSize` (default: 10,000 items).
- When depth reaches `maxSize`, `enqueue()` immediately throws `JobError` with code `QUEUE_UNAVAILABLE` and retryable set to `true`.
- Callers (API/Dispatchers) receive backpressure errors and can defer or throttle requests.

---

## 5. Queue Message Contract

Messages encapsulate job identity and transport metadata (`src/jobs/queue/QueueMessage.ts`):

```typescript
export interface QueueMessage {
  messageId: string;
  jobId: string;
  jobType: JobType;
  priority: JobPriority;
  workspaceId: string;
  repositoryId?: string;
  enqueuedAt: Date;
  availableAt: Date;
  attempt: number;
  maxRetries: number;
  payloadReference?: string;
  correlationId?: string;
  receiptHandle?: string;
  visibleAfter?: Date;
}
```

---

## 6. Pluggable Providers

The queue architecture is provider-neutral. Future providers can be added without altering worker or dispatcher logic:
- **Redis Streams / BullMQ Provider**: Distributed Redis-backed queue with consumer groups.
- **PostgreSQL / SQLite Provider**: Durable relational table queue using `FOR UPDATE SKIP LOCKED`.
- **Cloud SQS / PubSub Provider**: Managed cloud queues for multi-region deployments.
