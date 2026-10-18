import { describe, it, expect } from 'vitest';
import {
  isValidJobTransition,
  isTerminalJobStatus,
  compareJobPriorities,
  createJobProgress,
  JobError,
  type JobStatus,
  type JobPriority,
} from '../../src/jobs/index.js';

describe('Jobs - Job Model & Lifecycle Transitions', () => {
  it('validates allowed lifecycle status transitions', () => {
    // Normal happy path
    expect(isValidJobTransition('CREATED', 'QUEUED')).toBe(true);
    expect(isValidJobTransition('QUEUED', 'RUNNING')).toBe(true);
    expect(isValidJobTransition('RUNNING', 'COMPLETED')).toBe(true);

    // Retry path
    expect(isValidJobTransition('RUNNING', 'RETRY_PENDING')).toBe(true);
    expect(isValidJobTransition('RETRY_PENDING', 'QUEUED')).toBe(true);
    expect(isValidJobTransition('RETRY_PENDING', 'DEAD_LETTERED')).toBe(true);

    // Timeout path
    expect(isValidJobTransition('RUNNING', 'TIMED_OUT')).toBe(true);
    expect(isValidJobTransition('TIMED_OUT', 'DEAD_LETTERED')).toBe(true);

    // Cancellation
    expect(isValidJobTransition('CREATED', 'CANCELLED')).toBe(true);
    expect(isValidJobTransition('QUEUED', 'CANCELLED')).toBe(true);
    expect(isValidJobTransition('RUNNING', 'CANCELLED')).toBe(true);
  });

  it('rejects illegal transitions from terminal or incompatible states', () => {
    // From terminal states
    expect(isValidJobTransition('COMPLETED', 'RUNNING')).toBe(false);
    expect(isValidJobTransition('CANCELLED', 'QUEUED')).toBe(false);
    expect(isValidJobTransition('DEAD_LETTERED', 'RUNNING')).toBe(false);

    // Illegal skip
    expect(isValidJobTransition('CREATED', 'COMPLETED')).toBe(false);
    expect(isValidJobTransition('QUEUED', 'COMPLETED')).toBe(false);
  });

  it('identifies terminal states correctly', () => {
    expect(isTerminalJobStatus('COMPLETED')).toBe(true);
    expect(isTerminalJobStatus('CANCELLED')).toBe(true);
    expect(isTerminalJobStatus('DEAD_LETTERED')).toBe(true);
    expect(isTerminalJobStatus('RUNNING')).toBe(false);
    expect(isTerminalJobStatus('QUEUED')).toBe(false);
  });

  it('compares priority levels accurately', () => {
    // Lower numeric weight = higher execution priority
    expect(compareJobPriorities('CRITICAL', 'HIGH')).toBeLessThan(0);
    expect(compareJobPriorities('HIGH', 'NORMAL')).toBeLessThan(0);
    expect(compareJobPriorities('NORMAL', 'LOW')).toBeLessThan(0);
    expect(compareJobPriorities('NORMAL', 'NORMAL')).toBe(0);
  });

  it('creates bounded progress metrics', () => {
    const p1 = createJobProgress(45, 100, 'Processing items');
    expect(p1.percentage).toBe(45);
    expect(p1.completed).toBe(45);
    expect(p1.total).toBe(100);
    expect(p1.message).toBe('Processing items');

    // Bounded bounds check
    const p2 = createJobProgress(150, 100);
    expect(p2.completed).toBe(100);
    expect(p2.percentage).toBe(100);

    const p3 = createJobProgress(-10, 50);
    expect(p3.completed).toBe(0);
    expect(p3.percentage).toBe(0);
  });

  it('constructs structured JobError with retryable classification', () => {
    const err = new JobError('JOB_TIMEOUT', 'Execution exceeded 30000ms', true, { timeoutMs: 30000 });
    expect(err.code).toBe('JOB_TIMEOUT');
    expect(err.retryable).toBe(true);
    expect(err.message).toBe('Execution exceeded 30000ms');

    const json = err.toJSON();
    expect(json.code).toBe('JOB_TIMEOUT');
    expect(json.retryable).toBe(true);
    expect(json.details).toEqual({ timeoutMs: 30000 });
  });
});
