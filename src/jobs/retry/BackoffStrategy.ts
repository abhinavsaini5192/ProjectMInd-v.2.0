export type BackoffStrategy = 'FIXED' | 'EXPONENTIAL' | 'EXPONENTIAL_WITH_JITTER';

export function computeBackoffDelay(
  attempt: number,
  initialDelayMs: number = 1000,
  maxDelayMs: number = 60000,
  strategy: BackoffStrategy = 'EXPONENTIAL_WITH_JITTER',
  factor: number = 2
): number {
  if (attempt <= 0) return 0;

  let delay = initialDelayMs;

  switch (strategy) {
    case 'FIXED':
      delay = initialDelayMs;
      break;

    case 'EXPONENTIAL':
      delay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
      break;

    case 'EXPONENTIAL_WITH_JITTER': {
      const baseDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
      // Full jitter: random between 50% and 100% of baseDelay
      const jitterFactor = 0.5 + Math.random() * 0.5;
      delay = Math.round(baseDelay * jitterFactor);
      break;
    }
  }

  return Math.min(maxDelayMs, Math.max(0, delay));
}
