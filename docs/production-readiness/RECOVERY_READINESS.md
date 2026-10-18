# ProjectMind Recovery & Reliability Readiness

## 1. Reliability Architecture

ProjectMind treats failures as routine operational events. The reliability subsystem (`src/reliability/`) prevents transient faults from cascading into total system outages.

---

## 2. 12 Failure Classifications

Implemented in `src/reliability/models/FailureClassification.ts`:

1. `TRANSIENT_NETWORK`: Transient socket timeouts or dropped connections; retried with exponential jitter.
2. `PERSISTENCE_TRANSIENT`: SQLite busy lock; retried with short backoff.
3. `PERSISTENCE_CORRUPTION`: Integrity check failed; trips circuit breaker and requires DR snapshot restore.
4. `DEPENDENCY_TIMEOUT`: Subordinate service exceeded deadline; triggers graceful degradation.
5. `DEPENDENCY_UNAVAILABLE`: External service unreachable; circuit opened.
6. `RESOURCE_EXHAUSTION`: Out-of-memory or file descriptor limit reached; sheds inbound load.
7. `AGENT_DISCONNECT`: External coding agent terminated mid-task; preserves session checkpoint.
8. `KNOWLEDGE_CONFLICT`: Conflicting concurrent updates; re-resolved topologically.
9. `SECURITY_VIOLATION`: Malicious payload or authorization bypass; contained immediately.
10. `CONFIGURATION_ERROR`: Invalid environment variable or schema; fails fast at startup.
11. `DATA_INCONSISTENCY`: Graph edge or feature mapping mismatch; reconciled during startup.
12. `UNHANDLED_EXCEPTION`: Unexpected runtime crash; caught by error boundary with crash dump.

---

## 3. Circuit Breaker State Machine

Implemented in `src/reliability/resilience/CircuitBreaker.ts`:

```
               [Failure Threshold Exceeded]
    [CLOSED] ─────────────────────────────────→ [OPEN]
       ↑                                          │
       │                                          │ [Cooldown Elapsed]
       │         [Probe Request Succeeded]        ↓
       └───────────────────────────────────── [HALF_OPEN]
                         │
                         │ [Probe Request Failed]
                         └─────────────────────────→ [OPEN]
```

- In `CLOSED` state: Requests pass normally.
- In `OPEN` state: Requests fail fast immediately without waiting for timeouts.
- In `HALF_OPEN` state: A single canary request tests recovery. If successful, state resets to `CLOSED`.

---

## 4. Disaster Recovery & Scope Locking

Implemented in `src/reliability/disaster/DisasterRecoveryManager.ts`:

### 4.1 7 Disaster Recovery Tiers
- **TIER 0 (IN_MEMORY_RESTART):** Restart in-memory caches and queues.
- **TIER 1 (RECONCILE_STALE_STATE):** Reconcile uncommitted transactions against write-ahead journal.
- **TIER 2 (LOCAL_SNAPSHOT_RESTORE):** Restore verified SQLite snapshot from local disk.
- **TIER 3 (VOLUME_RESTORE):** Revert container persistent volume to daily snapshot.
- **TIER 4 (REMOTE_ARCHIVE_RESTORE):** Download and restore remote archive from durable object storage.
- **TIER 5 (CLEAN_REINDEX):** Reconstruct knowledge graph from raw git repository source files.
- **TIER 6 (EMERGENCY_REBUILD):** Full bootstrap initialization in a clean workspace.

### 4.2 Exclusive Scope Locking
Disaster recovery procedures acquire an exclusive write lock on the target workspace (`ws:<workspaceId>`). No agent sessions, background jobs, or API writes can execute during recovery drills or restore operations.

---

## 5. Controlled Failure Injection Test Results

All controlled failure injection suites pass in `tests/reliability/`:

- `tests/reliability/failureClassification.test.ts` (9 tests) — 12 failure classifications.
- `tests/reliability/circuitBreaker.test.ts` (8 tests) — State transitions and recovery.
- `tests/reliability/startupRecovery.test.ts` (5 tests) — Crash reboot recovery.
- `tests/reliability/gracefulShutdown.test.ts` (5 tests) — 7-step clean termination.
- `tests/reliability/disasterRecovery.test.ts` (8 tests) — 7-tier restore simulation.
- `tests/reliability/recoveryVerifier.test.ts` (7 tests) — Integrity validation.
- `tests/reliability/knowledgeReconciliation.test.ts` (4 tests) — Conflict resolution.
- `tests/reliability/failureInjection.test.ts` (15 tests) — Injected storage & network faults.

**Total Reliability Tests:** 57 tests, 100% passing.
