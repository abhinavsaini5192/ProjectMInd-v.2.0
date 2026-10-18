import { describe, it, expect } from 'vitest';
import { FailureClassifier } from '../../src/reliability/failure/FailureClassifier.js';
import { VersionConflictError } from '../../src/storage/consistency/ConcurrencyTypes.js';
import { JobError } from '../../src/jobs/models/JobError.js';
import { StaleComputationError } from '../../src/concurrency/consistency/StaleResultDetector.js';

describe('Reliability - FailureClassifier', () => {
  const classifier = new FailureClassifier();

  it('classifies network and storage disconnect errors as DEPENDENCY and retryable', () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5432 - database unavailable');
    const record = classifier.classify(error, { operation: 'query_features' });

    expect(record.category).toBe('DEPENDENCY');
    expect(record.retryable).toBe(true);
    expect(record.severity).toBe('HIGH');
    expect(record.errorCode).toBe('DEPENDENCY_UNAVAILABLE');
    expect(record.operation).toBe('query_features');
  });

  it('classifies timeouts and aborts as TIMEOUT and retryable', () => {
    const error = new Error('Operation timed out after 30000ms');
    const record = classifier.classify(error);

    expect(record.category).toBe('TIMEOUT');
    expect(record.retryable).toBe(true);
    expect(record.errorCode).toBe('OPERATION_TIMEOUT');
  });

  it('classifies authorization and permission denials as AUTHORIZATION and non-retryable', () => {
    const error = new Error('Permission denied: actor lacks workspace:admin scope');
    const record = classifier.classify(error);

    expect(record.category).toBe('AUTHORIZATION');
    expect(record.retryable).toBe(false);
    expect(record.severity).toBe('CRITICAL');
    expect(record.errorCode).toBe('AUTHORIZATION_DENIED');
  });

  it('classifies validation failures as VALIDATION and non-retryable', () => {
    const error = new Error('Invalid request payload: property "workspaceId" must be non-empty');
    const record = classifier.classify(error);

    expect(record.category).toBe('VALIDATION');
    expect(record.retryable).toBe(false);
    expect(record.errorCode).toBe('VALIDATION_FAILED');
  });

  it('classifies data corruption and hash mismatches as DATA_INTEGRITY and non-retryable', () => {
    const error = new Error('Checksum mismatch: storage block corrupted');
    const record = classifier.classify(error);

    expect(record.category).toBe('DATA_INTEGRITY');
    expect(record.retryable).toBe(false);
    expect(record.severity).toBe('CRITICAL');
    expect(record.errorCode).toBe('DATA_INTEGRITY_VIOLATION');
  });

  it('classifies VersionConflictError as CONCURRENCY and retryable', () => {
    const error = new VersionConflictError('Feature', 'feat-auth', 2, 3);
    const record = classifier.classify(error);

    expect(record.category).toBe('CONCURRENCY');
    expect(record.retryable).toBe(true);
    expect(record.errorCode).toBe('VERSION_CONFLICT');
    expect(record.resource).toBe('Feature:feat-auth');
  });

  it('classifies StaleComputationError as CONCURRENCY and non-retryable (requires refresh)', () => {
    const error = new StaleComputationError('repo-core', 5, 6);
    const record = classifier.classify(error);

    expect(record.category).toBe('CONCURRENCY');
    expect(record.retryable).toBe(false);
    expect(record.errorCode).toBe('STALE_RESULT');
    expect(record.resource).toBe('repo-core');
  });

  it('classifies JobError according to Phase 8.6 error code specifications', () => {
    const jobErrRetryable = new JobError('QUEUE_UNAVAILABLE', 'Queue capacity exhausted', true);
    const rec1 = classifier.classify(jobErrRetryable);
    expect(rec1.category).toBe('DEPENDENCY');
    expect(rec1.retryable).toBe(true);

    const jobErrAuth = new JobError('JOB_AUTHORIZATION_FAILED', 'Workspace mismatch', false);
    const rec2 = classifier.classify(jobErrAuth);
    expect(rec2.category).toBe('AUTHORIZATION');
    expect(rec2.retryable).toBe(false);
  });

  it('provides fast isRetryable check', () => {
    expect(classifier.isRetryable(new Error('connect ECONNRESET'))).toBe(true);
    expect(classifier.isRetryable(new Error('Forbidden: access denied'))).toBe(false);
  });
});
