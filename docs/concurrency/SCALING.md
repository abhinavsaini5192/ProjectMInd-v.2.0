# Multi-Instance Coordination & Scaling Readiness

## 1. Overview

ProjectMind is designed for multi-instance deployment readiness without mandating heavy distributed technologies prematurely. Multiple ProjectMind processes (Instance A, B, C) can share canonical storage and background job queues safely.

```
       ProjectMind Instance A           ProjectMind Instance B
      ┌──────────────────────┐         ┌──────────────────────┐
      │  API & Workers       │         │  API & Workers       │
      │  Leader: None        │         │  Leader: None        │
      └──────────┬───────────┘         └──────────┬───────────┘
                 │                                │
                 └───────────────┬────────────────┘
                                 │
                                 ▼
                    Shared Canonical Storage &
                    Coordination Layer (Leases/CAS)
```

---

## 2. Stateless Core Rule

To enable horizontal scaling:
- **No Shared In-Memory State for Correctness**: In-memory caches must remain invalidatable and safely bypassable.
- **No Local Process Locks for Shared Resources**: Operations requiring exclusivity across instances use `ICoordinationService` or `IResourceLockManager`.
- **Active-Active APIs and Workers**: API instances and worker pools do not require a global leader to handle requests or process background jobs.

---

## 3. Singleton Leader Election (`ILeaderElector`)

Global leadership is **NOT** required for normal operations. It is used strictly for single-coordinator tasks:

1. **Schema Migrations**:
   - When multiple instances start up simultaneously, each attempts to acquire `leader:migration-runner`.
   - Exactly one instance executes migrations.
   - Other instances observe, wait, or proceed once migration completes.
2. **Periodic Maintenance Sweepers**:
   - `leader:maintenance-sweeper` ensures only one instance runs retention pruning or tombstone sweeps per interval.

If a leader crashes, its lease expires, and another instance assumes leadership automatically via `LeaderElector` heartbeat failover.
