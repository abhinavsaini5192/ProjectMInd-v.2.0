export interface IConcurrencyLimiter {
  readonly capacity: number;
  readonly activeCount: number;
  readonly queueDepth: number;

  /**
   * Acquires a permit. Waits up to timeoutMs if capacity is full.
   * Returns a release function or throws if timed out.
   */
  acquire(timeoutMs?: number): Promise<() => void>;

  /**
   * Executes an asynchronous task within the bounded concurrency limit.
   */
  run<T>(task: () => Promise<T>, timeoutMs?: number): Promise<T>;
}
