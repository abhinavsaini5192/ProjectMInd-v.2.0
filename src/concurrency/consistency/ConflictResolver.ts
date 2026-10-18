import { randomUUID } from 'crypto';
import type {
  IConflictResolver,
  ConflictResolutionContext,
  ConflictResolutionResult,
} from './IConflictResolver.js';
import type { ConcurrencyConflict, ConflictResolutionAction } from '../models/Conflict.js';

export class ConflictResolver implements IConflictResolver {
  public resolve(context: ConflictResolutionContext): ConflictResolutionResult {
    const attempt = context.attempt ?? 1;
    const maxRetries = context.maxRetries ?? 3;

    let action: ConflictResolutionAction;
    let shouldRetry = false;
    let backoffDelayMs: number | undefined;

    switch (context.conflictType) {
      case 'RESOURCE_LOCK_CONFLICT':
        if (attempt <= maxRetries) {
          action = 'RETRY';
          shouldRetry = true;
          // Exponential backoff with jitter
          const base = Math.min(2000, 100 * Math.pow(2, attempt));
          backoffDelayMs = Math.floor(Math.random() * base) + 50;
        } else {
          action = 'REJECT';
          shouldRetry = false;
        }
        break;

      case 'VERSION_CONFLICT':
        if (attempt <= maxRetries) {
          action = 'REFRESH';
          shouldRetry = true;
          backoffDelayMs = 50 * attempt;
        } else {
          action = 'REJECT';
          shouldRetry = false;
        }
        break;

      case 'STALE_RESULT':
        // Stale background results cannot be committed over newer state
        action = 'REFRESH';
        shouldRetry = false;
        break;

      case 'DUPLICATE_OPERATION':
        // Idempotent duplicate: ignore safely without error
        action = 'IGNORE_DUPLICATE';
        shouldRetry = false;
        break;

      case 'SCOPE_CONFLICT':
      case 'STATE_TRANSITION_CONFLICT':
        // Semantic/security boundary conflicts are never retried
        action = 'REJECT';
        shouldRetry = false;
        break;

      case 'DEPENDENCY_CONFLICT':
        action = 'MANUAL_REVIEW';
        shouldRetry = false;
        break;

      default:
        action = 'REJECT';
        shouldRetry = false;
    }

    const conflict: ConcurrencyConflict = {
      conflictId: `conf-${randomUUID()}`,
      type: context.conflictType,
      resourceKey: context.resourceKey,
      expectedVersion: context.expectedVersion,
      actualVersion: context.actualVersion,
      action,
      message:
        context.message ??
        `Concurrency conflict [${context.conflictType}] on resource '${context.resourceKey}' resolved with action '${action}'`,
      timestamp: Date.now(),
      retryable: shouldRetry,
    };

    return {
      conflict,
      action,
      shouldRetry,
      backoffDelayMs,
    };
  }
}
