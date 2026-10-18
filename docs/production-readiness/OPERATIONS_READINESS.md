# ProjectMind Operational Readiness & Runbooks

## 1. Observability & Telemetry Architecture

ProjectMind operations rely on structured telemetry and non-blocking failure-isolated logging:

- **Structured Logging:** Output formatted as single-line JSON with timestamps, log level, component name, operation, correlation ID, and sanitized metadata.
- **Metrics Collection:** `PlatformMetricsCollector` tracks counters, gauges, and timing histograms with bounded cardinality to prevent memory leaks.
- **Distributed Tracing:** Every request generates or propagates a `correlationId` through context generation, knowledge updates, and database calls.
- **Health Endpoints:**
  - `/api/v1/health` — Full system component health report.
  - `/api/v1/health/liveness` — Process heartbeat (for container orchestration).
  - `/api/v1/health/readiness` — Dependency and storage readiness check.

---

## 2. Operational Runbooks

### Runbook 1: Startup Failure (Crash on Boot)
- **Symptoms:** Container exits with code 1; log indicates `PlatformConfigError` or `SecurityConfigError`.
- **Diagnosis:** Missing required environment variables (e.g. `PROJECTMIND_SECRET_KEY` < 32 characters in production mode).
- **Safe Actions:**
  1. Inspect environment variables against `.env.example`.
  2. Verify persistent volume directory exists and is writable.
  3. Restart container with valid configuration.
- **Forbidden Actions:** Never set `PROJECTMIND_ENV=development` in production to bypass validation.

### Runbook 2: Storage / SQLite Lock Contention
- **Symptoms:** API returns `503 SERVICE_UNAVAILABLE`; log message `SQLITE_BUSY` or `LOCK_CONTENDED`.
- **Diagnosis:** Long-running transaction or unclosed connection from previous crash.
- **Safe Actions:**
  1. Check disk I/O utilization on persistent storage.
  2. Execute `DisasterRecoveryManager.reconcile()` to verify WAL checkpoint.
  3. If persistent, trigger graceful restart to release stale file locks.

### Runbook 3: Job Queue Backlog
- **Symptoms:** Metrics gauge `jobs_queue_depth` increases continuously; knowledge updates delayed.
- **Diagnosis:** Worker pool saturated or long-running tasks timing out.
- **Safe Actions:**
  1. Query active worker states via `PlatformHealthService`.
  2. Check if jobs are failing and entering exponential retry backoff.
  3. Increase `workerPoolSize` in configuration if CPU resources permit.

### Runbook 4: Security Incident / Compromised Session
- **Symptoms:** High frequency of `AUTHORIZATION_DENIAL` or `CROSS_WORKSPACE_VIOLATION` events.
- **Diagnosis:** Compromised agent token or rogue coding assistant script.
- **Safe Actions:**
  1. Record incident in `SecurityIncidentManager`.
  2. Trigger automated containment: `revokeSession(sessionId)`.
  3. Rotate affected agent API key.
  4. Invalidate context cache for affected feature: `invalidateCache(workspaceId)`.

### Runbook 5: Database Migration Failure
- **Symptoms:** Startup fails during schema upgrade; error `MigrationFailedException`.
- **Diagnosis:** Conflicting schema changes or interrupted previous migration.
- **Safe Actions:**
  1. Check current schema version recorded in `_migrations` table.
  2. Restore pre-migration database snapshot from backup directory.
  3. Verify migration script syntax before reapplying.
- **Forbidden Actions:** Never manually alter column types in SQLite tables without migration definitions.

### Runbook 6: Disaster Recovery & Snapshot Restore
- **Symptoms:** Catastrophic data corruption or accidental file deletion.
- **Diagnosis:** Unrecoverable repository graph or corrupted SQLite database.
- **Procedure:**
  1. Stop inbound traffic by calling `agentRuntime.pause("DR restore in progress")`.
  2. Acquire exclusive workspace lock: `ResourceLockManager.acquire("ws:<id>", "dr_admin")`.
  3. Invoke `DisasterRecoveryManager.restoreSnapshot(snapshotId)`.
  4. Run `RecoveryVerifier.verifyIntegrity()`.
  5. Check `/api/v1/health` returns `HEALTHY`.
  6. Release lock and resume agent runtime: `agentRuntime.resume()`.

### Runbook 7: Emergency Graceful Shutdown
- **Symptoms:** Host node decommissioning, scheduled hardware maintenance, or uncontained security breach.
- **Procedure:**
  1. Send `SIGTERM` to ProjectMind process.
  2. Process executes 7-step shutdown:
     - Stop inbound requests.
     - Pause AgentSessionManager.
     - Drain in-flight worker jobs (up to shutdown timeout).
     - Persist agent runtime checkpoints.
     - Flush telemetry and audit log buffers.
     - Close SQLite storage and native graph engines.
     - Process exits with code 0.
