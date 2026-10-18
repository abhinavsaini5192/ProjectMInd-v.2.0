import type Database from 'better-sqlite3';

export const JOB_DATABASE_SCHEMA_SQL = `
-- 1. Durable Jobs Table
CREATE TABLE IF NOT EXISTS pm_durable_jobs (
  job_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  workspace_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'default-org',
  repository_id TEXT,
  session_id TEXT,
  task_id TEXT,
  correlation_id TEXT,
  trace_id TEXT,
  created_at TEXT NOT NULL,
  scheduled_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 300000,
  idempotency_key TEXT,
  parent_job_id TEXT,
  dependencies_json TEXT,
  payload_json TEXT NOT NULL,
  result_json TEXT,
  error_json TEXT,
  progress_json TEXT,
  worker_id TEXT,
  fencing_token INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes for performance & concurrency
CREATE INDEX IF NOT EXISTS idx_pm_jobs_status_prio ON pm_durable_jobs(status, priority, scheduled_at, created_at);
CREATE INDEX IF NOT EXISTS idx_pm_jobs_workspace ON pm_durable_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_pm_jobs_org ON pm_durable_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_pm_jobs_worker ON pm_durable_jobs(worker_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_jobs_idempotency ON pm_durable_jobs(workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Job Execution Attempts Table
CREATE TABLE IF NOT EXISTS pm_job_attempts (
  attempt_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES pm_durable_jobs(job_id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  worker_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  outcome TEXT NOT NULL,
  error_classification TEXT,
  error_details_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_pm_attempts_job ON pm_job_attempts(job_id);

-- 3. Persistent Dead Letter Queue Table
CREATE TABLE IF NOT EXISTS pm_job_dead_letter (
  dead_letter_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'default-org',
  repository_id TEXT,
  failure_reason TEXT NOT NULL,
  error_code TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  correlation_id TEXT,
  dead_lettered_at TEXT NOT NULL,
  replayed_at TEXT,
  replayed_by TEXT,
  replay_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX IF NOT EXISTS idx_pm_dlq_workspace ON pm_job_dead_letter(workspace_id, status);

-- 4. Transactional Event Outbox Table
CREATE TABLE IF NOT EXISTS pm_event_outbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  workspace_id TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'default-org',
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_seq INTEGER NOT NULL DEFAULT 1,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  dispatched_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pm_outbox_poll ON pm_event_outbox(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_pm_outbox_agg ON pm_event_outbox(aggregate_type, aggregate_id, aggregate_seq);

-- 5. Transactional Event Inbox & Deduplication Table
CREATE TABLE IF NOT EXISTS pm_event_inbox (
  inbox_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  consumer_name TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_seq INTEGER NOT NULL DEFAULT 1,
  processed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  result_json TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_inbox_dedup ON pm_event_inbox(event_id, consumer_name);
CREATE INDEX IF NOT EXISTS idx_pm_inbox_seq ON pm_event_inbox(consumer_name, aggregate_type, aggregate_id, aggregate_seq);

-- 6. Event Replay Audit Table
CREATE TABLE IF NOT EXISTS pm_event_replay_audit (
  replay_id TEXT PRIMARY KEY,
  initiated_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  filter_criteria_json TEXT NOT NULL,
  events_matched INTEGER NOT NULL,
  events_replayed INTEGER NOT NULL,
  initiated_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

-- 7. Durable Job Queue Table
CREATE TABLE IF NOT EXISTS pm_queue_messages (
  message_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  priority_weight INTEGER NOT NULL DEFAULT 2,
  receipt_handle TEXT,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  enqueued_at TEXT NOT NULL,
  available_at_ms INTEGER NOT NULL,
  visible_after_ms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'READY'
);
CREATE INDEX IF NOT EXISTS idx_pm_queue_poll ON pm_queue_messages(status, priority_weight, available_at_ms, enqueued_at);
CREATE INDEX IF NOT EXISTS idx_pm_queue_receipt ON pm_queue_messages(receipt_handle);
CREATE INDEX IF NOT EXISTS idx_pm_queue_job ON pm_queue_messages(job_id);
`;

export function initializeJobDatabaseSchema(db: Database.Database): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(JOB_DATABASE_SCHEMA_SQL);
}
