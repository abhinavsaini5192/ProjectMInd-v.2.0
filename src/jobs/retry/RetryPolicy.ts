import type { BackoffStrategy } from './BackoffStrategy.js';
import { JobError } from '../models/JobError.js';

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffStrategy: BackoffStrategy;
  isRetryable(error: unknown): boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffStrategy: 'EXPONENTIAL_WITH_JITTER',
  isRetryable: (error: unknown): boolean => {
    if (error instanceof JobError) {
      return error.retryable;
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      // Non-retryable indicators
      if (
        msg.includes('validation') ||
        msg.includes('unauthorized') ||
        msg.includes('forbidden') ||
        msg.includes('unknown job') ||
        msg.includes('not found') ||
        msg.includes('invalid')
      ) {
        return false;
      }
      // Retryable indicators
      if (
        msg.includes('timeout') ||
        msg.includes('busy') ||
        msg.includes('locked') ||
        msg.includes('network') ||
        msg.includes('connection') ||
        msg.includes('conflict') ||
        msg.includes('econnrefused')
      ) {
        return true;
      }
    }

    return false;
  },
};
