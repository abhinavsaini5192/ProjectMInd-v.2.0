import { describe, it, expect } from 'vitest';
import {
  ErrorClassifier,
  ErrorCategory,
  StandardizedError,
} from '../../src/observability/errors/ErrorClassification.js';

describe('Error Classification & Operational Context Suite', () => {
  it('classifies validation errors accurately', () => {
    const error = new Error('Invalid parameter: query must not be empty');
    error.name = 'ValidationError';

    const classified = ErrorClassifier.classify(error);
    expect(classified.category).toBe(ErrorCategory.VALIDATION_ERROR);
    expect(classified.isRetryable).toBe(false);
    expect(classified.httpStatus).toBe(400);
    expect(classified.clientSafeMessage).toContain('Invalid parameter');
  });

  it('classifies authentication and authorization errors', () => {
    const authError = new Error('Invalid token provided');
    authError.name = 'AuthenticationError';

    const classifiedAuth = ErrorClassifier.classify(authError);
    expect(classifiedAuth.category).toBe(ErrorCategory.AUTHENTICATION_ERROR);
    expect(classifiedAuth.isRetryable).toBe(false);
    expect(classifiedAuth.httpStatus).toBe(401);

    const forbiddenError = new Error('Insufficient permissions to write repository');
    forbiddenError.name = 'ForbiddenError';

    const classifiedForbidden = ErrorClassifier.classify(forbiddenError);
    expect(classifiedForbidden.category).toBe(ErrorCategory.AUTHORIZATION_ERROR);
    expect(classifiedForbidden.isRetryable).toBe(false);
    expect(classifiedForbidden.httpStatus).toBe(403);
  });

  it('classifies timeouts and rate limits with proper retry hints', () => {
    const timeoutError = new Error('Database query timed out after 5000ms');
    timeoutError.name = 'TimeoutError';

    const classifiedTimeout = ErrorClassifier.classify(timeoutError);
    expect(classifiedTimeout.category).toBe(ErrorCategory.TIMEOUT);
    expect(classifiedTimeout.isRetryable).toBe(true);
    expect(classifiedTimeout.httpStatus).toBe(504);

    const rateLimitError = new Error('Too many requests, quota exceeded');
    (rateLimitError as unknown as { statusCode: number }).statusCode = 429;

    const classifiedRateLimit = ErrorClassifier.classify(rateLimitError);
    expect(classifiedRateLimit.category).toBe(ErrorCategory.RATE_LIMITED);
    expect(classifiedRateLimit.isRetryable).toBe(true);
    expect(classifiedRateLimit.httpStatus).toBe(429);
  });

  it('classifies concurrency and distributed lock conflicts', () => {
    const lockError = new Error('Failed to acquire distributed lock for resource: lock_workspace_123');
    lockError.name = 'LockAcquisitionError';

    const classifiedLock = ErrorClassifier.classify(lockError);
    expect(classifiedLock.category).toBe(ErrorCategory.CONCURRENCY_CONFLICT);
    expect(classifiedLock.isRetryable).toBe(true);
    expect(classifiedLock.httpStatus).toBe(409);
  });

  it('classifies dependency outages and preserves underlying causes', () => {
    const rootCause = new Error('ECONNREFUSED 127.0.0.1:6379');
    const dbError = new Error('Redis coordination service is unreachable');
    (dbError as unknown as { cause: Error }).cause = rootCause;

    const classified = ErrorClassifier.classify(dbError);
    expect(classified.category).toBe(ErrorCategory.DEPENDENCY_OUTAGE);
    expect(classified.isRetryable).toBe(true);
    expect(classified.httpStatus).toBe(503);
    expect(classified.rootCause).toBe('ECONNREFUSED 127.0.0.1:6379');
  });

  it('distinguishes retryable job failures from permanent job failures', () => {
    const retryable = new StandardizedError({
      category: ErrorCategory.RETRYABLE_JOB_FAILURE,
      message: 'Temporary downstream socket hangup during index sync',
      isRetryable: true,
      httpStatus: 500,
    });
    expect(retryable.isRetryable).toBe(true);

    const permanent = new StandardizedError({
      category: ErrorCategory.PERMANENT_JOB_FAILURE,
      message: 'Corrupted payload syntax cannot be parsed',
      isRetryable: false,
      httpStatus: 422,
    });
    expect(permanent.isRetryable).toBe(false);
  });

  it('separates client-safe messages from internal diagnostic details', () => {
    const internalErr = new Error('SQLite busy: disk I/O error at sector 0x892a during WAL checkpoint');
    const classified = ErrorClassifier.classify(internalErr);

    expect(classified.diagnosticDetails).toContain('SQLite busy: disk I/O error');
    // Ensure client safe message does not expose internal disk/sector addresses
    expect(classified.clientSafeMessage).not.toContain('sector 0x892a');
  });
});
