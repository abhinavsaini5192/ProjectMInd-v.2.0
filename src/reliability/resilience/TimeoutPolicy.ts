export class TimeoutError extends Error {
  constructor(public readonly operationName: string, public readonly timeoutMs: number) {
    super(`Operation '${operationName}' timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export class TimeoutPolicy {
  /**
   * Executes an asynchronous operation bounded by a strict timeout.
   * Passes an AbortSignal to the operation to allow cooperative deadline cancellation.
   */
  public static async withTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    operationName: string = 'anonymous'
  ): Promise<T> {
    if (timeoutMs <= 0) {
      throw new Error(`Timeout duration must be positive: got ${timeoutMs}ms`);
    }

    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new TimeoutError(operationName, timeoutMs));
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(controller.signal), timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
