# Concurrency & Scaling Infrastructure

## 1. Overview

Phase 8.7 establishes the production concurrency, coordination, and horizontal-scaling readiness foundation for ProjectMind. The platform coordinates concurrent API requests, background job workers, multiple agent sessions, feature analyses, context orchestrations, and schema migrations while guaranteeing consistency, tenant isolation, and zero lost updates.

```
                               ProjectMind Instance
                ┌─────────────────────────────────────────────────┐
                │                                                 │
                │   API Boundary         Worker Pool      Agents  │
                │        │                    │              │    │
                │        ▼                    ▼              ▼    │
                │     WorkloadLimiter (Tenant Fairness & Limits)   │
                │        │                    │              │    │
                │        ▼                    ▼              ▼    │
                │   RequestCoalescer     ResourceLockManager       │
                │   (Single-Flight)      (Scoped Exclusive Locks) │
                │        │                    │              │    │
                │        ▼                    ▼              ▼    │
                │   OptimisticLockManager (Version Tokens & CAS)  │
                │        │                    │              │    │
                │        ▼                    ▼              ▼    │
                │   ConflictResolver & StaleResultDetector        │
                │                                                 │
                └─────────────────────────┬───────────────────────┘
                                          │
                                          ▼
                         Shared Canonical Storage & State
```

---

## 2. Core Principles

1. **Correctness Before Throughput**: A faster system that permits silent lost updates or cache corruption is not production-ready.
2. **Optimistic Concurrency by Default**: Prefer version checks and Compare-and-Set over global locks. Locking is reserved exclusively for unmergeable operations (migrations, bulk renames).
3. **Fine-Grained Scoping**: Locks are partitioned strictly by `workspace:repository:feature:resource`. A lock on Repository A never blocks Repository B.
4. **Tenant Fairness & Backpressure**: Workload limits prevent any single workspace from monopolizing global worker or connection capacity.
5. **Horizontal-Scaling Readiness**: Core coordination is abstracted into provider-neutral interfaces (`ICoordinationService`, `IResourceLockManager`, `IWorkloadLimiter`), ensuring single-instance and multi-instance deployments behave identically.

---

## 3. Subsystem Directory

| Module | Core Interfaces / Classes | Purpose |
| :--- | :--- | :--- |
| **`models/`** | `ConcurrencyPolicy`, `ConcurrencyToken`, `ResourceLock`, `Lease`, `ConcurrencyConflict`, `WorkloadRequest` | Typed contracts, operation classes, and tokens. |
| **`locking/`** | `IResourceLockManager`, `ResourceLockManager`, `LockResult` | Scoped exclusive resource locks with TTL expiration and jittered retry. |
| **`coordination/`** | `ICoordinationService`, `CoordinationService`, `ILeaderElector`, `LeaderElector` | Distributed-safe leases, atomic CAS, and singleton leader election. |
| **`limits/`** | `IConcurrencyLimiter`, `ConcurrencyLimiter`, `IWorkloadLimiter`, `WorkloadLimiter` | Bounded semaphores, per-workspace fairness limits, and backpressure queues. |
| **`coalescing/`** | `IRequestCoalescer`, `RequestCoalescer` | Single-flight deduplication of concurrent identical context and analysis computations. |
| **`consistency/`** | `IConflictResolver`, `ConflictResolver`, `StaleResultDetector` | Deterministic conflict categorization and stale background result rejection. |
| **`recovery/`** | `StaleLockRecoveryManager` | Automatic detection and reclamation of expired locks from crashed workers. |
| **`observability/`** | `ConcurrencyTelemetry`, `ConcurrencyHealthDiagnostic` | Metrics, logs, trace spans, and concurrency health diagnostics. |
| **`di/`** | `ConcurrencyTokens`, `ConcurrencyDISetup` | Dependency injection wiring and container registration. |

---

## 4. Documentation Index

- [CONCURRENCY_MODEL.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/CONCURRENCY_MODEL.md): Operation classification and policy matrix.
- [LOCKING.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/LOCKING.md): Scoped locks, TTLs, re-entrancy, and contention handling.
- [LEASES.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/LEASES.md): Time-bounded leases, renewal loops, and heartbeat recovery.
- [VERSIONING.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/VERSIONING.md): Optimistic version tokens, atomic CAS, and lost-update prevention.
- [CONFLICTS.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/CONFLICTS.md): Conflict resolution strategies (RETRY, REJECT, REFRESH, IGNORE_DUPLICATE).
- [SCALING.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/SCALING.md): Multi-instance coordination, leader election, and migration singleton.
- [WORKLOAD_LIMITS.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/WORKLOAD_LIMITS.md): Tenant fairness, priority queues, and backpressure limits.
- [CACHE_CONCURRENCY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/CACHE_CONCURRENCY.md): Request coalescing, security-aware keys, and stampede prevention.
- [FAILURE_RECOVERY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/FAILURE_RECOVERY.md): Worker crash recovery, stale lock reclamation, and sweeper sweeps.
- [SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/concurrency/SECURITY.md): Scope-aware locking, token tamper protection, and tenant isolation.
