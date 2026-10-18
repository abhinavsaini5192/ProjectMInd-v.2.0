# ProjectMind Operational Reliability Runbooks (Incidents A through M)

This document provides step-by-step procedures for on-call engineers and operators responding to production incidents. Every procedure details symptoms, diagnosis, safe automated/manual actions, verification steps, escalation paths, and rollback/recovery steps.

---

## Runbook Index
- [Runbook A: API Outage](#runbook-a-api-outage)
- [Runbook B: Database Outage](#runbook-b-database-outage)
- [Runbook C: Worker Outage](#runbook-c-worker-outage)
- [Runbook D: Queue Outage](#runbook-d-queue-outage)
- [Runbook E: EventBus Outage](#runbook-e-eventbus-outage)
- [Runbook F: Cache Outage](#runbook-f-cache-outage)
- [Runbook G: Knowledge Inconsistency](#runbook-g-knowledge-inconsistency)
- [Runbook H: Failed Migration](#runbook-h-failed-migration)
- [Runbook I: Stale Jobs](#runbook-i-stale-jobs)
- [Runbook J: Stale Locks](#runbook-j-stale-locks)
- [Runbook K: Backup Failure](#runbook-k-backup-failure)
- [Runbook L: Restore](#runbook-l-restore)
- [Runbook M: Full Application Recovery](#runbook-m-full-application-recovery)

---

### Runbook A: API Outage
- **Symptoms**: HTTP 502/503/504 errors on `/api/v1/context` or `/health` returning non-200. Gateway reporting no healthy upstream nodes.
- **Diagnosis**: Check process status (`systemctl status projectmind` or `kubectl get pods`). Inspect logs for unhandled crashes or failed readiness probes. Check if `StartupRecoveryManager` failed any checklist step.
- **Safe Actions**: If process crashed, restart container/pod. Node will automatically execute `StartupRecoveryManager.executeStartupRecovery()` before routing traffic.
- **Verification**: Query `GET /health` and confirm `state: 'HEALTHY'` or `state: 'DEGRADED'`, with HTTP 200.
- **Escalation**: Escalate to Platform Core team if process enters crash-loop backoff with schema or storage corruption errors.
- **Rollback/Recovery**: Roll back to previously deployed container image if recent release introduced syntax or dependency breakage.

---

### Runbook B: Database Outage
- **Symptoms**: Logs show `ECONNREFUSED` on port 5432 / disk I/O errors. Metrics show `reliability_failures_total` spiking with `category: 'DEPENDENCY'`. Health state is `UNAVAILABLE`.
- **Diagnosis**: Verify primary storage service connectivity. Inspect database server CPU, disk space, and connection pool exhaustion.
- **Safe Actions**: Restart primary database service or switch over to warm standby. Application will reject incoming writes safely to protect data consistency.
- **Verification**: Run diagnostic check via `RecoveryVerifier.verify()` or restart ProjectMind node to re-run storage connectivity check.
- **Escalation**: Escalate to Database Administrator if storage disk volume is full or corrupted.
- **Rollback/Recovery**: If primary volume is unrecoverable, initiate Runbook L (Restore).

---

### Runbook C: Worker Outage
- **Symptoms**: Background jobs piling up in `QUEUED` state. No jobs transitioning to `RUNNING` or `COMPLETED`.
- **Diagnosis**: Check worker pool process status. Inspect worker logs for fatal unhandled exceptions or out-of-memory kills (`ExitCode: 137`).
- **Safe Actions**: Restart worker pods or scale up worker deployment replicas.
- **Verification**: Observe `jobs_completed_total` incrementing and queue depth decreasing in Prometheus dashboards.
- **Escalation**: Escalate to Systems Lead if workers repeatedly crash on specific job payloads.
- **Rollback/Recovery**: Poison pill jobs causing worker crashes should be manually moved to dead-letter queue via Job API.

---

### Runbook D: Queue Outage
- **Symptoms**: Job dispatch calls throwing `JobError('QUEUE_UNAVAILABLE')`. High API latency on endpoints dispatching asynchronous work.
- **Diagnosis**: Check queue broker connectivity (Redis/RabbitMQ/memory buffer). Inspect broker memory and socket limits.
- **Safe Actions**: Restart queue broker process. Re-enable broker listener.
- **Verification**: Check `jobs_queue_depth` metric and verify dispatch returns `202 Accepted` with valid `jobId`.
- **Escalation**: Escalate to Infrastructure team if queue message persistence partition is corrupted.
- **Rollback/Recovery**: Replay in-flight unacknowledged jobs from durable storage.

---

### Runbook E: EventBus Outage
- **Symptoms**: Domain events failing to publish. Subscriptions not firing. Logs report `channel closed` or `EventBus partition offline`.
- **Diagnosis**: Check EventBus channel health. Inspect thread event loop lag.
- **Safe Actions**: Trigger EventBus reconnect or restart broker cluster.
- **Verification**: Publish test probe event and confirm receipt by active subscribers.
- **Escalation**: Escalate to Messaging Infrastructure team if broker partition rebalance hangs.
- **Rollback/Recovery**: Replay missed domain events using event store persistence logs.

---

### Runbook F: Cache Outage
- **Symptoms**: Distributed cache (e.g. Redis) unreachable. Latency increases on repetitive context queries.
- **Diagnosis**: Check cache server status. `DependencyDegradationManager` records `redis_cache` as degraded.
- **Safe Actions**: Platform automatically operates in degraded mode by falling back to authoritative database. Restart cache daemon.
- **Verification**: `DependencyDegradationManager.recordSuccess('redis_cache')` clears degraded flag; health returns to `HEALTHY`.
- **Escalation**: Escalate to Cache Admin if cluster memory eviction loops continuously.
- **Rollback/Recovery**: Invalidate cache keys on startup to prevent serving stale pre-outage cache entries.

---

### Runbook G: Knowledge Inconsistency
- **Symptoms**: Repository resource changes committed, but corresponding semantic features or symbol mappings missing or outdated.
- **Diagnosis**: Inspect repository version via `IKnowledgeVersionManager.getLatestVersion(repositoryId)`. Check if `affectedResources` > 0 while derived features = 0.
- **Safe Actions**: Invoke `KnowledgeReconciliationService.reconcileRepository(repositoryId)`. Reconciler will dispatch idempotent `FEATURE_MAPPING` job.
- **Verification**: Confirm reconciliation report shows `inconsistenciesResolved > 0` and zero `manualReviewItems`.
- **Escalation**: If `manualReviewItems` has items with `severity: 'HIGH'`, inspect repository AST manually before applying changes.
- **Rollback/Recovery**: Discard partial derived state and re-queue clean full feature discovery job.

---

### Runbook H: Failed Migration
- **Symptoms**: `StartupRecoveryManager` halts with `[schema_compatibility] Storage schema version is incompatible with application`. Node refuses to become `READY`.
- **Diagnosis**: Inspect database migration history table. Identify failed migration step and error stack trace.
- **Safe Actions**: Do NOT bypass schema check or manually force startup. Investigate failed DDL/DML script.
- **Verification**: Execute migration rollback or fix migration script, then restart node to allow `StartupRecoveryManager` to re-verify.
- **Escalation**: Escalate to Platform Architecture / Database Schema owner.
- **Rollback/Recovery**: Execute migration `down()` script to revert database schema to previous stable version, and deploy matching previous application binary.

---

### Runbook I: Stale Jobs
- **Symptoms**: Jobs stuck in `RUNNING` or `QUEUED` state long past their execution deadline or lease expiration.
- **Diagnosis**: Query job repository for jobs where `status == 'RUNNING'` and `heartbeat < (now - leaseTtlMs)`.
- **Safe Actions**: Trigger `JobRecoveryManager.recoverStaleJobs()`. Expired jobs within retry budget will be re-queued; jobs with exhausted attempts will be moved to `DEAD_LETTER`.
- **Verification**: Stale job count drops to 0; recovered jobs resume execution on healthy workers.
- **Escalation**: Escalate to Job Platform team if recovered jobs consistently fail on lease acquisition.
- **Rollback/Recovery**: Inspect dead letter queue payloads and resolve underlying job bugs before replaying.

---

### Runbook J: Stale Locks
- **Symptoms**: Operations fail with `ResourceLockAcquisitionError` or `Could not acquire exclusive restore lock`.
- **Diagnosis**: Inspect active locks in `IResourceLockManager`. Check if lock holder node/worker has died without releasing lock.
- **Safe Actions**: Invoke `StaleLockRecoveryManager.sweep()`. Expired locks whose TTL has passed will be safely purged.
- **Verification**: Lock sweep report lists purged lock keys. Subsequent lock acquisition requests succeed.
- **Escalation**: Escalate if lock TTL is configured excessively high or heartbeat renewals are leaking across dead processes.
- **Rollback/Recovery**: Force release single contended lock key only after confirming the original owner process is terminated.

---

### Runbook K: Backup Failure
- **Symptoms**: Scheduled backup job fails or `BackupRestoreValidator.validateBackup()` returns `isValid: false`.
- **Diagnosis**: Inspect backup manager logs for disk space exhaustion, snapshot timeouts, or checksum generation errors.
- **Safe Actions**: Ensure sufficient storage capacity on backup destination volume. Re-run backup creation job with clean idempotency key.
- **Verification**: Verify new backup metadata passes `BackupRestoreValidator.validateBackup()` with status `COMPLETED`.
- **Escalation**: Escalate to Storage & Security Operations if cryptographic signing or hash computation fails.
- **Rollback/Recovery**: Retain previous valid backup snapshot until a new valid backup is confirmed.

---

### Runbook L: Restore
- **Symptoms**: Catastrophic data loss or corruption requiring recovery to a prior known-good recovery point.
- **Diagnosis**: Identify target `backupId`. Confirm backup validity via `BackupRestoreValidator.validateBackup()`. Check application and schema version compatibility.
- **Safe Actions**:
  1. Authenticate with platform administrative credentials (`authorizedBy`).
  2. Invoke `DisasterRecoveryManager.executeDisasterRestore({ backupId, authorizedBy, targetWorkspaceId, currentStorageVersion })`.
  3. System will automatically acquire exclusive coordination lock `dr:restore:${scope}` to block concurrent writes.
  4. System executes restore and runs full `RecoveryVerifier.verify()` suite.
- **Verification**: Check returned `RecoveryOperation` status is `RECOVERED` and verification passed on all 7 components.
- **Escalation**: If status is `BLOCKED` (lock contention) or `FAILED`, escalate to Chief Reliability Engineer immediately.
- **Rollback/Recovery**: In the event of a botched restore, revert to the pre-restore snapshot captured prior to the restore execution.

---

### Runbook M: Full Application Recovery
- **Symptoms**: Total cluster outage (all API nodes, workers, and background schedulers down).
- **Diagnosis**: Perform incident triage across infrastructure tier (compute, networking, persistent storage).
- **Safe Actions**:
  1. Restore and verify persistent database connectivity.
  2. Deploy base application cluster.
  3. Each node executes `StartupRecoveryManager`: validates storage, checks schema, sweeps expired leases, recovers orphaned jobs, and reconciles derived knowledge.
  4. Verify all nodes report HTTP 200 on `/health`.
  5. Enable ingress traffic on API gateway.
- **Verification**: Run `RecoveryVerifier.verify()`. Run synthetic end-to-end context query to verify agent retrieval pipeline.
- **Escalation**: Escalate to Incident Commander if storage recovery requires cross-region snapshot replication.
- **Rollback/Recovery**: Follow Level 7 Disaster Recovery procedures if primary regional infrastructure is irrecoverable.
