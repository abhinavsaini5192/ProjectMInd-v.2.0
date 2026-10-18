# ProjectMind Disaster Recovery Architecture & Operational Runbooks

ProjectMind establishes a resilient, production-oriented disaster recovery and high availability architecture. This document defines the recovery lifecycle, safety constraints, and 12 executable disaster recovery runbooks covering critical failure modes across databases, workers, caches, distributed coordination, and derived intelligence.

---

## 1. System Inventory & Classification Baseline

| System / Component | Technology & Storage | Classification | Consistency / Backup Strategy |
| :--- | :--- | :--- | :--- |
| **Workspace & Repositories** | SQLite (`repositories`, `workspace_metadata`) | **AUTHORITATIVE** | Atomic online backup (`projectmind backup create`), SHA-256 verified |
| **User & Runtime Settings** | SQLite (`settings`) | **AUTHORITATIVE** | Atomic online backup, WAL checkpointed |
| **Memories & Learning State** | SQLite (`memories`, `memory_history`) | **AUTHORITATIVE** | Atomic online backup, never overwritten by rebuilds |
| **Durable Jobs & Attempts** | SQLite (`pm_durable_jobs`, `pm_job_attempts`) | **AUTHORITATIVE** | Atomic online backup; lease recovery on crash |
| **Dead-Letter Queue (DLQ)** | SQLite (`pm_job_dead_letter`) | **AUTHORITATIVE** | Preserved indefinitely; audited replay |
| **Transactional Outbox/Inbox** | SQLite (`pm_event_outbox`, `pm_event_inbox`) | **AUTHORITATIVE** | Two-phase dispatch; deduplication idempotency |
| **Schema Migrations** | SQLite (`pm_schema_migrations`) | **AUTHORITATIVE** | Migration versioning validated before & after restore |
| **File Metadata & Symbols** | SQLite (`file_metadata`, `symbols`) | **DERIVED** | Reconstructible via AST indexing (`projectmind backup staleness`) |
| **Ephemeral Cache** | SQLite (`cache_entries`) / Redis | **EPHEMERAL** | Safe to prune at any time (`projectmind backup prune-cache`) |

---

## 2. Disaster Recovery Operational Runbooks

### Runbook 1: Primary Database Loss or Destruction
- **Symptoms & Detection**: Application logs `SQLITE_CANTOPEN` or file missing error; `projectmind health` returns `UNHEALTHY` for storage subsystem.
- **Initial Safety Checks**: Confirm container/host storage mount is accessible; verify process has permissions on `.projectmind/data/`.
- **Systems & Data Affected**: Core API, durable jobs, persistent memories, repository registry.
- **Recovery Prerequisites**: Valid backup in `.projectmind/data/backups/` or offsite storage; authorized operator credential.
- **Exact Operational Steps**:
  ```bash
  # 1. Enumerate available verified backups
  node bin/projectmind.js backup list

  # 2. Verify integrity and SHA-256 checksum of chosen backup
  node bin/projectmind.js backup verify <backupId>

  # 3. Restore to an isolated verification target first
  node bin/projectmind.js backup restore <backupId> --target .projectmind/data/projectmind.db.test --authorized-by "ops-lead"

  # 4. Once verified, restore to production location with explicit confirmation
  node bin/projectmind.js backup restore <backupId> --target .projectmind/data/projectmind.db --authorized-by "ops-lead" --confirm-production-overwrite

  # 5. Verify system health
  node bin/projectmind.js health
  ```
- **Validation Criteria**: `projectmind health` returns `HEALTHY`; schema migration version matches expected release.
- **Rollback / Abort**: Pre-restore safety copy (`.pre_restore_safety_<timestamp>.db`) is automatically preserved.
- **Expected Downtime & Data Loss**: Downtime: 2–5 minutes. Data loss: transactions committed between last backup and failure ($RPO \le \text{backup interval}$).
- **Escalation**: Database Administrator / Platform Engineering.
- **Post-Recovery**: Run `projectmind backup staleness` to detect if derived indexes need re-indexing.

---

### Runbook 2: Accidental Data Deletion
- **Symptoms & Detection**: User reports accidental deletion of a repository, memory, or workspace setting.
- **Initial Safety Checks**: Inspect `.pre_restore_safety_*.db` or recent backup metadata; do not write changes to target.
- **Systems & Data Affected**: Specific workspace or repository records.
- **Recovery Prerequisites**: Verified pre-incident backup artifact.
- **Exact Operational Steps**:
  ```bash
  # 1. Identify backup timestamped prior to accidental deletion
  node bin/projectmind.js backup list

  # 2. Restore into an isolated recovery target database
  node bin/projectmind.js backup restore <backupId> --target .projectmind/data/recovery_inspect.db --authorized-by "sec-ops"

  # 3. Extract the required records from recovery_inspect.db and re-insert into active database
  node bin/projectmind.js doctor
  ```
- **Validation Criteria**: Target entity successfully recovered and visible in `projectmind status`.
- **Rollback**: Remove isolated `recovery_inspect.db`.
- **Expected Downtime & Data Loss**: Zero downtime (performed against isolated database); zero data loss for recovered record.
- **Escalation**: System Operator.
- **Post-Recovery Reconciliation**: Audit log recorded in observability stream.

---

### Runbook 3: Corrupted Database State
- **Symptoms & Detection**: SQLite returns `SQLITE_CORRUPT` or `PRAGMA integrity_check` fails; `projectmind health` returns `DEGRADED` or `UNHEALTHY`.
- **Initial Safety Checks**: Immediately freeze external mutations; stop worker instances to prevent dirty writes.
- **Systems & Data Affected**: SQLite database pages.
- **Recovery Prerequisites**: Last verified uncorrupted backup.
- **Exact Operational Steps**:
  ```bash
  # 1. Verify backup integrity
  node bin/projectmind.js backup verify <latestValidBackupId>

  # 2. Restore database with automatic safety snapshot and stale WAL/SHM purge
  node bin/projectmind.js backup restore <latestValidBackupId> --target .projectmind/data/projectmind.db --authorized-by "dr-commander" --confirm-production-overwrite

  # 3. Clean ephemeral caches to avoid stale cache hits
  node bin/projectmind.js backup prune-cache

  # 4. Verify system health
  node bin/projectmind.js health
  ```
- **Validation Criteria**: `PRAGMA integrity_check` returns `ok`; `PRAGMA foreign_key_check` returns 0 violations.
- **Rollback**: Automatic safety snapshot preserved before overwrite.
- **Expected Downtime & Data Loss**: Downtime $\le 5$ minutes; data loss bounded by last backup interval.
- **Escalation**: Lead Reliability Engineer.
- **Post-Recovery Reconciliation**: Sweep and requeue recoverable durable jobs.

---

### Runbook 4: Failed or Incomplete Backup Process
- **Symptoms & Detection**: Alert `BACKUP_FAILED` emitted; `.db.tmp` file left in backup directory; backup size 0.
- **Initial Safety Checks**: Check disk space (`df -h`); verify write permissions in backup directory.
- **Systems & Data Affected**: Backup storage pool; active backup cycle.
- **Recovery Prerequisites**: Ensure no other backup operation is currently running.
- **Exact Operational Steps**:
  ```bash
  # 1. Check existing backups (verifying last verified copy remains safe)
  node bin/projectmind.js backup list

  # 2. Trigger fresh on-demand backup
  node bin/projectmind.js backup create --description "Manual remediation backup"

  # 3. Validate newly generated backup
  node bin/projectmind.js backup verify <newBackupId>
  ```
- **Validation Criteria**: New backup completes with status `COMPLETED` and valid SHA-256 hash.
- **Rollback**: If disk space is exhausted, prune oldest non-essential backups (retention engine automatically guarantees last verified copy is NEVER deleted).
- **Expected Downtime & Data Loss**: Zero downtime; zero data loss.
- **Escalation**: DevOps on-call.
- **Post-Recovery**: Verify metric `projectmind_backup_operations_total{status="success"}` increments.

---

### Runbook 5: Loss of Primary Deployment Environment
- **Symptoms & Detection**: Host node fails, Kubernetes cluster node unschedulable, or datacenter zone outage.
- **Initial Safety Checks**: Confirm failover environment / secondary host is booted and network routes updated.
- **Systems & Data Affected**: Entire service fleet (API, workers, scheduler).
- **Recovery Prerequisites**: Configuration repository, secrets stored in vault/env, latest offsite backup.
- **Exact Operational Steps**:
  ```bash
  # 1. Provision secondary container instance / pod
  docker-compose -f docker-compose.prod.yml up -d

  # 2. Restore database from replicated backup
  node bin/projectmind.js backup restore <offsiteBackupId> --target .projectmind/data/projectmind.db --authorized-by "platform-lead" --confirm-production-overwrite

  # 3. Execute platform diagnostic sweep
  node bin/projectmind.js health --verbose
  node bin/projectmind.js doctor
  ```
- **Validation Criteria**: All health checks return `HEALTHY`; API responds to liveness and readiness probes.
- **Rollback**: Fallback to tertiary node if secondary has hardware faults.
- **Expected Downtime & Data Loss**: Downtime: 5–15 minutes (RTO target < 15 min); data loss bounded by offsite replication lag.
- **Escalation**: Cloud Infrastructure Team.
- **Post-Recovery**: Run worker lease reconciliation to reclaim interrupted durable jobs.

---

### Runbook 6: Queue Broker Outage (SQLite / Redis Queue Unresponsive)
- **Symptoms & Detection**: Worker cannot poll or enqueue messages; `queue_depth` metric stale.
- **Initial Safety Checks**: In SQLite durable mode, check table locks on `pm_queue_messages`; in Redis mode, check ping.
- **Systems & Data Affected**: Asynchronous job dispatch and background workers.
- **Recovery Prerequisites**: Database access or queue broker restart permissions.
- **Exact Operational Steps**:
  ```bash
  # 1. Run doctor check to inspect storage lock contention
  node bin/projectmind.js doctor

  # 2. In SQLite mode: clean expired in-flight messages (visibility timeout reset)
  # Background worker automatically sweeps stale leases via JobRecoveryManager

  # 3. Verify health
  node bin/projectmind.js health
  ```
- **Validation Criteria**: Queue messages transition from `IN_FLIGHT` to `READY`; worker successfully claims jobs.
- **Rollback**: Pause new job ingestion if worker fleet is overwhelmed.
- **Expected Downtime & Data Loss**: Zero data loss (durable queue messages persist in database); job processing delayed.
- **Escalation**: Backend Core Team.
- **Post-Recovery**: Inspect dead-letter queue for any poison tasks that caused worker crashes.

---

### Runbook 7: Redis or Distributed Coordination Backend Outage
- **Symptoms & Detection**: Distributed locks fail to acquire; leader election falls back or fails.
- **Initial Safety Checks**: Verify whether application is configured for single-instance or multi-instance mode.
- **Systems & Data Affected**: Multi-worker concurrency, distributed leasing.
- **Recovery Prerequisites**: Redis cluster access or local fallback mode.
- **Exact Operational Steps**:
  ```bash
  # 1. Check health
  node bin/projectmind.js health --verbose

  # 2. When Redis is unavailable, platform activates degraded mode
  # Workers gracefully fall back to local transactional leasing with database fencing tokens
  ```
- **Validation Criteria**: Database fencing tokens prevent stale worker writes; operations complete safely in degraded mode.
- **Rollback**: Reconnect Redis cluster once restored; instances automatically resume distributed coordination.
- **Expected Downtime & Data Loss**: Zero downtime for core APIs; zero data loss.
- **Escalation**: Infrastructure SRE.
- **Post-Recovery**: Clear stale distributed leases.

---

### Runbook 8: Vector-Store Loss
- **Symptoms & Detection**: Semantic search commands fail or return embedding retrieval errors.
- **Initial Safety Checks**: Confirm SQLite metadata and memory tables are intact.
- **Systems & Data Affected**: Semantic retrieval, embedding queries.
- **Recovery Prerequisites**: Source codebase files available; model embeddings API accessible.
- **Exact Operational Steps**:
  ```bash
  # 1. Verify authoritative memories are intact
  node bin/projectmind.js memory list

  # 2. Check derived index staleness
  node bin/projectmind.js backup staleness

  # 3. Trigger asynchronous durable re-indexing job
  node bin/projectmind.js backup prune-cache
  ```
- **Validation Criteria**: Vector embeddings rebuilt from authoritative source code and memories.
- **Rollback**: Fallback to exact lexical code search (`projectmind search --exact`).
- **Expected Downtime & Data Loss**: Core API operational throughout; semantic retrieval degraded until rebuild finishes.
- **Escalation**: AI/ML Platform Engineer.
- **Post-Recovery**: Verify search accuracy against reference queries.

---

### Runbook 9: Worker Fleet Failure
- **Symptoms & Detection**: Workers terminated due to OOM or node eviction; jobs remain in `RUNNING` status with expired leases.
- **Initial Safety Checks**: Check container exit codes (SIGKILL code 137 indicates OOM).
- **Systems & Data Affected**: Background execution tasks.
- **Recovery Prerequisites**: Worker container restart capability.
- **Exact Operational Steps**:
  ```bash
  # 1. Inspect system health
  node bin/projectmind.js health

  # 2. Worker nodes restart; JobRecoveryManager automatically identifies expired worker leases
  # Jobs with remaining retries return to QUEUED; exhausted jobs move to DEAD_LETTERED

  # 3. Verify worker recovery in logs
  node bin/projectmind.js doctor
  ```
- **Validation Criteria**: Expired jobs reclaimed; retryable jobs resume execution; dead-letter jobs recorded.
- **Rollback**: Scale up worker memory limits if OOM was caused by large file parsing.
- **Expected Downtime & Data Loss**: Zero data loss; durable jobs preserved through failure.
- **Escalation**: Platform Operations.
- **Post-Recovery**: Review DLQ records for root-cause error details.

---

### Runbook 10: Stale or Incompatible Derived Indexes
- **Symptoms & Detection**: Code navigation references outdated line numbers or symbols; `backup staleness` reports mismatched hashes.
- **Initial Safety Checks**: Verify repository git working copy is at target commit.
- **Systems & Data Affected**: `file_metadata`, `symbols` tables.
- **Recovery Prerequisites**: Active database connection.
- **Exact Operational Steps**:
  ```bash
  # 1. Probe index staleness
  node bin/projectmind.js backup staleness

  # 2. Purge ephemeral context and query cache
  node bin/projectmind.js backup prune-cache

  # 3. Run full analyze to rebuild symbols and file metadata
  node bin/projectmind.js analyze --workspace .
  ```
- **Validation Criteria**: `projectmind backup staleness` reports `Derived intelligence index is UP TO DATE`.
- **Rollback**: None required; derived tables are safely reconstructible.
- **Expected Downtime & Data Loss**: Zero downtime; zero data loss (memories and settings unaffected).
- **Escalation**: None.
- **Post-Recovery**: Confirm symbol count matches codebase size.

---

### Runbook 11: Encryption Key Unavailability
- **Symptoms & Detection**: Storage or credentials cannot be decrypted; startup checks fail with `KEY_UNAVAILABLE`.
- **Initial Safety Checks**: Check secret provider (KMS / Vault / environment variable `PROJECTMIND_SECRET_KEY`).
- **Systems & Data Affected**: Encrypted configurations and sensitive workspace credentials.
- **Recovery Prerequisites**: Access to secret escrow or key rotation vault.
- **Exact Operational Steps**:
  ```bash
  # 1. Verify key reference in environment
  # Ensure PROJECTMIND_SECRET_KEY is populated from secure secret store

  # 2. Run diagnostic health probe
  node bin/projectmind.js doctor

  # 3. Restart application process with restored key
  node bin/projectmind.js health
  ```
- **Validation Criteria**: Doctor report shows security and storage subsystems `HEALTHY`.
- **Rollback**: Do not overwrite data with a new uncoordinated key.
- **Expected Downtime & Data Loss**: Process paused until key restored; zero data loss.
- **Escalation**: Security Officer / Key Custodian.
- **Post-Recovery**: Audit access logs to verify key was loaded securely without leaking in logs.

---

### Runbook 12: Partial Restoration Failure
- **Symptoms & Detection**: Restore process interrupted mid-operation (power failure, process kill); target database invalid or incomplete.
- **Initial Safety Checks**: Check for `.pre_restore_safety_<timestamp>.db` in target directory.
- **Systems & Data Affected**: Target restore path.
- **Recovery Prerequisites**: Intact backup artifact in backup directory and pre-restore safety copy.
- **Exact Operational Steps**:
  ```bash
  # 1. Verify backup artifact integrity again
  node bin/projectmind.js backup verify <backupId>

  # 2. If restore was interrupted, clean temporary restore files (*.restore_tmp_*)
  # and re-execute clean restore to isolated target
  node bin/projectmind.js backup restore <backupId> --target .projectmind/data/projectmind.db --authorized-by "ops-lead" --confirm-production-overwrite

  # 3. Verify integrity
  node bin/projectmind.js health
  ```
- **Validation Criteria**: Post-restore integrity check succeeds; all tables and migration records present.
- **Rollback**: If backup artifact is unreadable, roll back to pre-restore safety copy by renaming `.pre_restore_safety_*.db` to active database.
- **Expected Downtime & Data Loss**: Downtime: 2–5 minutes; data loss bounded by backup age.
- **Escalation**: Lead Reliability Engineer.
- **Post-Recovery**: Conduct post-mortem review of why initial restore was interrupted.
