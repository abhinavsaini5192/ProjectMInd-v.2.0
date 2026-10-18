# Cooperative Leases & Distributed Coordination

## 1. Overview

For long-running tasks, background workers, and singleton election, holding a static lock is dangerous because worker crashes would leave resources locked indefinitely. Phase 8.7 establishes **cooperative leases** via `ICoordinationService` (`src/concurrency/coordination/ICoordinationService.ts`).

---

## 2. Lease Contract (`src/concurrency/models/Lease.ts`)

```typescript
export interface Lease {
  readonly leaseId: string;
  readonly resourceId: string;
  readonly holderId: string;
  readonly acquiredAt: number;
  readonly expiresAt: number;
  readonly renewCount: number;
  readonly ttlMs: number;
  readonly scope: string;
}
```

---

## 3. Heartbeat Renewal Loop

Active leaseholders maintain their lease by sending periodic heartbeats at `ttlMs / 2`:

```
   Worker Start                  Periodic Heartbeat                  Worker Exit
        │                                 │                               │
        ▼                                 ▼                               ▼
  acquireLease() ────► [Running] ──► renewLease() ──► [Finished] ──► releaseLease()
                            │
                      Worker Crashes 💥
                            │
                      No heartbeats sent
                            │
                      TTL expires
                            │
                      Lease reclaimed by next instance
```

---

## 4. Atomic Compare-And-Set (CAS)

`ICoordinationService` provides atomic version testing and updating without distributed locks:

```typescript
compareAndSet(resourceId: string, expectedVersion: number, newVersion: number): Promise<boolean>
```

- Returns `true` only if the stored version matches `expectedVersion`.
- If another process updated the version concurrently, returns `false` immediately, enabling optimistic retry loops.
