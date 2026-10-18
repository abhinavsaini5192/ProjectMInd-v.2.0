export const CORE_METRIC_NAMES = {
  // API
  API_REQUESTS_TOTAL: 'api_requests_total',
  API_REQUEST_DURATION_MS: 'api_request_duration_ms',
  API_ERRORS_TOTAL: 'api_errors_total',

  // Storage
  STORAGE_QUERY_DURATION_MS: 'storage_query_duration_ms',
  STORAGE_TRANSACTION_FAILURES_TOTAL: 'storage_transaction_failures_total',
  STORAGE_CONNECTION_FAILURES_TOTAL: 'storage_connection_failures_total',
  STORAGE_MIGRATION_FAILURES_TOTAL: 'storage_migration_failures_total',

  // Context
  CONTEXT_GENERATION_TOTAL: 'context_generation_total',
  CONTEXT_GENERATION_DURATION_MS: 'context_generation_duration_ms',
  CONTEXT_CACHE_HITS_TOTAL: 'context_cache_hits_total',
  CONTEXT_CACHE_MISSES_TOTAL: 'context_cache_misses_total',
  CONTEXT_INVALIDATIONS_TOTAL: 'context_invalidations_total',
  CONTEXT_TOKEN_BUDGET_USAGE: 'context_token_budget_usage',

  // Feature Intelligence
  FEATURE_QUERIES_TOTAL: 'feature_queries_total',
  FEATURE_ANALYSIS_DURATION_MS: 'feature_analysis_duration_ms',
  FEATURE_IMPACT_DURATION_MS: 'feature_impact_duration_ms',

  // Knowledge
  KNOWLEDGE_UPDATES_TOTAL: 'knowledge_updates_total',
  KNOWLEDGE_UPDATE_DURATION_MS: 'knowledge_update_duration_ms',
  KNOWLEDGE_UPDATE_FAILURES_TOTAL: 'knowledge_update_failures_total',
  KNOWLEDGE_RETRIES_TOTAL: 'knowledge_retries_total',
  KNOWLEDGE_CONFLICTS_TOTAL: 'knowledge_conflicts_total',

  // Agent Runtime
  AGENT_ACTIVE_SESSIONS: 'agent_active_sessions',
  AGENT_TASKS_TOTAL: 'agent_tasks_total',
  AGENT_TASK_DURATION_MS: 'agent_task_duration_ms',
  AGENT_TASK_FAILURES_TOTAL: 'agent_task_failures_total',
  AGENT_CONTEXT_REFRESHES_TOTAL: 'agent_context_refreshes_total',

  // Verification
  VERIFICATION_RUNS_TOTAL: 'verification_runs_total',
  VERIFICATION_DURATION_MS: 'verification_duration_ms',
  VERIFICATION_RESULTS_TOTAL: 'verification_results_total',

  // Security
  SECURITY_AUTH_FAILURES_TOTAL: 'security_auth_failures_total',
  SECURITY_AUTHZ_DENIALS_TOTAL: 'security_authz_denials_total',
  SECURITY_SCOPE_VIOLATIONS_TOTAL: 'security_scope_violations_total',

  // Distributed Coordination & Locks
  LOCK_ACQUISITIONS_TOTAL: 'lock_acquisitions_total',
  LOCK_ACQUISITION_DURATION_MS: 'lock_acquisition_duration_ms',
  LOCK_ACQUISITION_FAILURES_TOTAL: 'lock_acquisition_failures_total',
  COORDINATION_FAILURES_TOTAL: 'coordination_failures_total',

  // Durable Jobs & Worker Pool
  JOBS_ENQUEUED_TOTAL: 'jobs_enqueued_total',
  JOBS_COMPLETED_TOTAL: 'jobs_completed_total',
  JOBS_FAILED_TOTAL: 'jobs_failed_total',
  JOBS_RETRIED_TOTAL: 'jobs_retried_total',
  JOBS_DEAD_LETTERED_TOTAL: 'jobs_dead_lettered_total',
  JOB_EXECUTION_DURATION_MS: 'job_execution_duration_ms',
  JOB_QUEUE_DEPTH: 'job_queue_depth',
  JOB_QUEUE_WAIT_TIME_MS: 'job_queue_wait_time_ms',
  WORKERS_ACTIVE: 'workers_active',
  WORKERS_BUSY: 'workers_busy',

  // Events, Outbox & Inbox
  OUTBOX_PENDING_EVENTS: 'outbox_pending_events',
  OUTBOX_DISPATCHED_TOTAL: 'outbox_dispatched_total',
  OUTBOX_FAILED_TOTAL: 'outbox_failed_total',
  INBOX_PROCESSED_TOTAL: 'inbox_processed_total',

  // Platform Lifecycle & Dependency
  DEPENDENCY_UP: 'dependency_up',
  PLATFORM_STARTUPS_TOTAL: 'platform_startups_total',
  PLATFORM_SHUTDOWNS_TOTAL: 'platform_shutdowns_total',

  // Backup & Disaster Recovery
  BACKUP_OPERATIONS_TOTAL: 'backup_operations_total',
  BACKUP_DURATION_MS: 'backup_duration_ms',
  BACKUP_SIZE_BYTES: 'backup_size_bytes',
  BACKUP_LAST_TIMESTAMP: 'backup_last_timestamp',
  BACKUP_VERIFICATION_FAILURES_TOTAL: 'backup_verification_failures_total',
  RESTORE_OPERATIONS_TOTAL: 'restore_operations_total',
  RESTORE_DURATION_MS: 'restore_duration_ms',
  BACKUPS_RETAINED_COUNT: 'backups_retained_count',
} as const;

