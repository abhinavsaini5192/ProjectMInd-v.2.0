import { randomUUID } from 'crypto';
import type { FailureRecord, FailureCategory, FailureSeverity } from '../models/FailureClassification.js';
import type { IFailureClassifier, FailureClassificationContext } from './IFailureClassifier.js';
import { VersionConflictError } from '../../storage/consistency/ConcurrencyTypes.js';
import { JobError } from '../../jobs/models/JobError.js';
import { StaleComputationError } from '../../concurrency/consistency/StaleResultDetector.js';

export class FailureClassifier implements IFailureClassifier {
  public classify(error: unknown, context: FailureClassificationContext = {}): FailureRecord {
    const failureId = `fail-${randomUUID()}`;
    const timestamp = Date.now();

    // 1. Explicit JobError from Phase 8.6
    if (error instanceof JobError) {
      const category = this.mapJobErrorCode(error.code);
      const retryable = error.retryable;
      const severity: FailureSeverity = retryable ? 'MEDIUM' : 'HIGH';

      return {
        failureId,
        category,
        severity,
        errorCode: error.code,
        message: error.message,
        operation: context.operation,
        resource: context.resource,
        timestamp,
        retryable,
        rawError: error,
        context: context.context,
      };
    }

    // 2. Concurrency VersionConflictError from Phase 8.4/8.7
    if (error instanceof VersionConflictError) {
      return {
        failureId,
        category: 'CONCURRENCY',
        severity: 'MEDIUM',
        errorCode: 'VERSION_CONFLICT',
        message: error.message,
        operation: context.operation,
        resource: `${error.entityType}:${error.entityId}`,
        timestamp,
        retryable: true,
        rawError: error,
        context: {
          ...context.context,
          expectedVersion: error.expectedVersion,
          actualVersion: error.actualVersion,
        },
      };
    }

    // 3. StaleComputationError from Phase 8.7
    if (error instanceof StaleComputationError) {
      return {
        failureId,
        category: 'CONCURRENCY',
        severity: 'MEDIUM',
        errorCode: 'STALE_RESULT',
        message: error.message,
        operation: context.operation,
        resource: error.resourceId,
        timestamp,
        retryable: false, // Cannot overwrite; must refresh
        rawError: error,
        context: {
          ...context.context,
          inputVersion: error.inputVersion,
          currentVersion: error.currentVersion,
        },
      };
    }

    // 4. Standard Error analysis
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      const name = error.name.toLowerCase();

      // Concurrency (deadlocks, optimistic lock, lease expiry, conflicts)
      if (
        name.includes('concurrency') ||
        name.includes('conflict') ||
        msg.includes('deadlock') ||
        msg.includes('conflict') ||
        msg.includes('lease') ||
        msg.includes('lock acquisition') ||
        msg.includes('stale worker') ||
        msg.includes('concurrent')
      ) {
        return {
          failureId,
          category: 'CONCURRENCY',
          severity: 'MEDIUM',
          errorCode: 'CONCURRENCY_CONFLICT',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: true,
          rawError: error,
          context: context.context,
        };
      }

      // Timeout / Abort / Deadline
      if (
        name.includes('abort') ||
        name.includes('timeout') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('deadline')
      ) {
        return {
          failureId,
          category: 'TIMEOUT',
          severity: 'HIGH',
          errorCode: 'OPERATION_TIMEOUT',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: true,
          rawError: error,
          context: context.context,
        };
      }

      // Authorization / Permission
      if (
        name.includes('auth') ||
        name.includes('security') ||
        msg.includes('unauthorized') ||
        msg.includes('forbidden') ||
        msg.includes('permission denied') ||
        msg.includes('access denied')
      ) {
        return {
          failureId,
          category: 'AUTHORIZATION',
          severity: 'CRITICAL',
          errorCode: 'AUTHORIZATION_DENIED',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: false,
          rawError: error,
          context: context.context,
        };
      }

      // Validation
      if (
        name.includes('validation') ||
        name.includes('syntax') ||
        msg.includes('invalid') ||
        msg.includes('malformed') ||
        msg.includes('schema mismatch') ||
        msg.includes('must be greater than 0')
      ) {
        return {
          failureId,
          category: 'VALIDATION',
          severity: 'MEDIUM',
          errorCode: 'VALIDATION_FAILED',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: false,
          rawError: error,
          context: context.context,
        };
      }

      // Data Integrity
      if (
        name.includes('integrity') ||
        name.includes('checksum') ||
        msg.includes('checksum') ||
        msg.includes('corrupted') ||
        msg.includes('hash mismatch')
      ) {
        return {
          failureId,
          category: 'DATA_INTEGRITY',
          severity: 'CRITICAL',
          errorCode: 'DATA_INTEGRITY_VIOLATION',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: false,
          rawError: error,
          context: context.context,
        };
      }

      // Dependency / Network / Broker / Storage outage
      if (
        msg.includes('econnrefused') ||
        msg.includes('econnreset') ||
        msg.includes('enotfound') ||
        msg.includes('network') ||
        msg.includes('connection lost') ||
        msg.includes('storage unavailable') ||
        msg.includes('database unavailable') ||
        msg.includes('broker') ||
        msg.includes('channel closed') ||
        msg.includes('offline') ||
        msg.includes('unreachable')
      ) {
        return {
          failureId,
          category: 'DEPENDENCY',
          severity: 'HIGH',
          errorCode: 'DEPENDENCY_UNAVAILABLE',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: true,
          rawError: error,
          context: context.context,
        };
      }

      // Resource exhaustion / OOM / backpressure
      if (
        msg.includes('backpressure') ||
        msg.includes('exhausted') ||
        msg.includes('rate limit') ||
        msg.includes('429') ||
        msg.includes('oom') ||
        msg.includes('sigkill') ||
        msg.includes('out of memory')
      ) {
        return {
          failureId,
          category: 'RESOURCE_EXHAUSTION',
          severity: 'CRITICAL',
          errorCode: 'RESOURCE_EXHAUSTED',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: true,
          rawError: error,
          context: context.context,
        };
      }

      // Transient / Interrupted updates
      if (msg.includes('interrupted') && !msg.includes('migration')) {
        return {
          failureId,
          category: 'TRANSIENT',
          severity: 'MEDIUM',
          errorCode: 'TRANSIENT_INTERRUPTION',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: true,
          rawError: error,
          context: context.context,
        };
      }

      // Configuration & Migration failures
      if (
        msg.includes('config') ||
        msg.includes('environment variable') ||
        msg.includes('missing setting') ||
        msg.includes('migration')
      ) {
        return {
          failureId,
          category: 'CONFIGURATION',
          severity: 'CRITICAL',
          errorCode: 'CONFIGURATION_ERROR',
          message: error.message,
          operation: context.operation,
          resource: context.resource,
          timestamp,
          retryable: false,
          rawError: error,
          context: context.context,
        };
      }

      // Default generic error
      return {
        failureId,
        category: 'UNKNOWN',
        severity: 'MEDIUM',
        errorCode: 'UNCLASSIFIED_ERROR',
        message: error.message,
        operation: context.operation,
        resource: context.resource,
        timestamp,
        retryable: false,
        rawError: error,
        context: context.context,
      };
    }

    // Non-Error object
    return {
      failureId,
      category: 'UNKNOWN',
      severity: 'LOW',
      errorCode: 'NON_ERROR_THROWN',
      message: String(error),
      operation: context.operation,
      resource: context.resource,
      timestamp,
      retryable: false,
      rawError: error,
      context: context.context,
    };
  }

  public isRetryable(error: unknown): boolean {
    const record = this.classify(error);
    return record.retryable;
  }

  private mapJobErrorCode(code: string): FailureCategory {
    switch (code) {
      case 'STORAGE_UNAVAILABLE':
      case 'QUEUE_UNAVAILABLE':
      case 'WORKER_UNAVAILABLE':
        return 'DEPENDENCY';
      case 'JOB_TIMEOUT':
        return 'TIMEOUT';
      case 'JOB_AUTHORIZATION_FAILED':
      case 'JOB_SCOPE_INVALID':
        return 'AUTHORIZATION';
      case 'INVALID_JOB':
      case 'JOB_PAYLOAD_INVALID':
      case 'UNKNOWN_JOB_TYPE':
        return 'VALIDATION';
      case 'JOB_ALREADY_RUNNING':
      case 'JOB_ALREADY_COMPLETED':
        return 'CONCURRENCY';
      default:
        return 'TRANSIENT';
    }
  }
}
