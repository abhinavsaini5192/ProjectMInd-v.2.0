# ProjectMind Failure Injection, Load & Resilience Verification (Phase 10.9)

ProjectMind incorporates a comprehensive, evidence-driven performance, scalability, reliability, and failure-resilience assessment system grounded in the integrated components of Phases 10.2–10.8.

## 1. Load-Testing Harness (`LoadTestHarness`)

Located at `src/benchmark/LoadTestHarness.ts`, this harness generates controlled concurrent workloads, captures high-resolution timing samples (`performance.now()`), and calculates:
- Throughput (operations / second)
- Latency percentiles: Average, Minimum, Maximum, P50, P90, P95, and P99
- Failure and timeout rates
- Resource deltas: RSS and Heap Used memory deltas pre- vs post-test

## 2. Failure Injection Harness (`FailureInjectionHarness`)

Located at `src/benchmark/FailureInjectionHarness.ts`, this module provides deterministic, controlled failure injection without destructive production effects:

| Scenario | Injected Condition | Expected System Response | Verification Method |
| :---: | :--- | :--- | :--- |
| **1** | SQLite Write Contention | `busy_timeout` backoff enables 50 concurrent transactions without database corruption | `testSqliteWriteContention()` |
| **2** | Worker Process Crash / Abandoned Lease | Visibility timeout expires; message returns to `READY` and is claimed by Worker 2 | `testWorkerLeaseExpirationRecovery()` |
| **3** | Poison Job Payload | Handler exceptions trigger retry backoff; after 3 failures, job is routed to DeadLetterQueue | `testPoisonJobDeadLetterRouting()` |
| **4** | Stale Lock Holder Rejection | Worker 1's lease expires; Worker 2 acquires lock; Worker 1's release is rejected | `testStaleLockHolderRejection()` |
| **5** | Queue Backpressure Overload | When queue reaches `maxCapacity`, additional submissions are rejected to bound memory | `testQueueBackpressureOverload()` |
| **6** | Corrupted Backup Snapshot | Corrupted database header or payload detected; `SqliteDatabaseRestoreManager` halts | `testCorruptedBackupDetection()` |
| **7** | Security Under Burst Load | Under concurrent traffic, 100% of illegal `LOCAL_DEVELOPMENT` and cross-tenant attempts are denied | `testSecurityPreservationUnderBurst()` |

## 3. CLI Benchmark Suite

Execute the comprehensive load and resilience suite directly via CLI:

```bash
node bin/projectmind.js benchmark
```

Produces machine-readable JSON artifacts at:
- `benchmark_report.json`
- `.projectmind/benchmarks/benchmark_report.json`

## 4. Automated Test Suites

Run the full automated load, resilience, and failure testing suites via Vitest:

```bash
npx vitest run tests/production/loadAndResilienceVerification.test.ts
```
