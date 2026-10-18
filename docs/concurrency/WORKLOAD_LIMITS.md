# Workload Limiting, Tenant Fairness & Backpressure

## 1. Overview

In multi-tenant or multi-workspace environments, an unconstrained burst of requests from Workspace A could starve all other workspaces of CPU, database connections, and worker slots. The `WorkloadLimiter` (`src/concurrency/limits/WorkloadLimiter.ts`) enforces global capacity caps alongside strict per-workspace concurrency limits.

---

## 2. Workload Limits Configuration

```typescript
export interface WorkloadLimits {
  readonly maxGlobalConcurrency: number;    // e.g. 50 simultaneous operations
  readonly maxWorkspaceConcurrency: number; // e.g. 10 simultaneous per workspace
  readonly maxQueueDepth: number;           // e.g. 1000 items
  readonly queueTimeoutMs: number;          // e.g. 30000ms
}
```

---

## 3. Tenant Fairness Guarantee

```
  Workspace A Burst (100 tasks)           Workspace B (1 task)
                │                                    │
                ▼                                    ▼
       ┌─────────────────────────────────────────────────────┐
       │                  WorkloadLimiter                    │
       │                                                     │
       │  Workspace A In-Use: 10/10 ──► Queued in FIFO       │
       │  Workspace B In-Use: 0/10  ──► GRANTED IMMEDIATELY  │
       │                                                     │
       └─────────────────────────────────────────────────────┘
```

Workspace B is never blocked by Workspace A's backlog. Permits are allocated independently up to each tenant's quota.

---

## 4. Backpressure & Queue Rejection

When total queued requests reach `maxQueueDepth`:
- Additional incoming requests are immediately rejected with `Error: Workload rejected due to backpressure`.
- Prevents uncontrolled memory growth and unbounded latency degradation.
- Callers receive clear 429/503-style retryable rejections rather than timing out silently.
