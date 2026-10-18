# Stale Lock Recovery & Failure Handling

## 1. Overview

In production, worker processes or instance nodes can crash unexpectedly while holding exclusive resource locks or coordination leases. Without active recovery mechanisms, orphaned locks would permanently freeze resources.

---

## 2. Recovery Architecture

```
        Active Node A (Holds Lock on Feature X)
                      │
                Node Crashes 💥
                      │
                      ▼
        Time Passes ────► Lock TTL Elapses (expiresAt < now)
                      │
                      ▼
        ┌────────────────────────────────────────────────┐
        │  Automatic Recovery via Two Mechanisms         │
        │                                                │
        │  1. Passive / On-Demand:                       │
        │     Next caller attempting acquire() detects   │
        │     expired lock and reclaims it instantly.    │
        │                                                │
        │  2. Active Background Sweeper:                 │
        │     StaleLockRecoveryManager runs every 15s,   │
        │     purges expired locks, and records metrics. │
        └────────────────────────────────────────────────┘
```

---

## 3. Passive vs. Active Reclamation

### 3.1. Passive (Immediate on Demand)
`ResourceLockManager.acquire()` inspects `existing.expiresAt`:
- If `existing.expiresAt <= Date.now()`, the stale lock is deleted immediately.
- The new caller successfully acquires the lock with zero delay.

### 3.2. Active (Background Sweeper)
`StaleLockRecoveryManager` (`src/concurrency/recovery/StaleLockRecoveryManager.ts`):
- Runs a periodic sweep (`sweep()`) across all active locks.
- Invokes `lockManager.purgeExpired()`.
- Emits telemetry counter `concurrency_lock_expired_total`.
- Logs structured warnings for operational audits.
