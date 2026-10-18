export type JobStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'RETRY_PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT'
  | 'DEAD_LETTERED'
  | 'UNKNOWN';

const VALID_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  CREATED: ['QUEUED', 'SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['QUEUED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'RETRY_PENDING', 'TIMED_OUT', 'CANCELLED', 'PAUSED', 'QUEUED', 'DEAD_LETTERED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  RETRY_PENDING: ['QUEUED', 'DEAD_LETTERED', 'CANCELLED'],
  FAILED: ['DEAD_LETTERED', 'RETRY_PENDING'],
  TIMED_OUT: ['DEAD_LETTERED', 'RETRY_PENDING', 'FAILED'],
  COMPLETED: [],
  CANCELLED: [],
  DEAD_LETTERED: [],
  UNKNOWN: ['CREATED', 'QUEUED', 'CANCELLED'],
};

export function isValidJobTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'DEAD_LETTERED';
}
