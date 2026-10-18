export type TelemetryDropPolicy = 'DROP_OLDEST' | 'DROP_NEWEST';

export interface BoundedQueueOptions {
  readonly maxSize?: number | undefined;
  readonly dropPolicy?: TelemetryDropPolicy | undefined;
}

export class BoundedTelemetryQueue<T> {
  private readonly items: T[] = [];
  private readonly maxSize: number;
  private readonly dropPolicy: TelemetryDropPolicy;
  private droppedCount = 0;
  private enqueuedCount = 0;

  constructor(options: BoundedQueueOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.dropPolicy = options.dropPolicy ?? 'DROP_OLDEST';
  }

  public enqueue(item: T): boolean {
    this.enqueuedCount++;
    if (this.items.length >= this.maxSize) {
      this.droppedCount++;
      if (this.dropPolicy === 'DROP_OLDEST') {
        this.items.shift();
        this.items.push(item);
        return true;
      } else {
        // DROP_NEWEST: item is dropped
        return false;
      }
    }
    this.items.push(item);
    return true;
  }

  public drain(maxBatch?: number): T[] {
    const count = maxBatch !== undefined ? Math.min(maxBatch, this.items.length) : this.items.length;
    return this.items.splice(0, count);
  }

  public size(): number {
    return this.items.length;
  }

  public getStats(): {
    readonly currentSize: number;
    readonly maxSize: number;
    readonly totalEnqueued: number;
    readonly totalDropped: number;
  } {
    return {
      currentSize: this.items.length,
      maxSize: this.maxSize,
      totalEnqueued: this.enqueuedCount,
      totalDropped: this.droppedCount,
    };
  }

  public clear(): void {
    this.items.length = 0;
  }
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  readonly failureThreshold?: number | undefined;
  readonly resetTimeoutMs?: number | undefined;
}

export class TelemetryCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public async execute<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
    const currentState = this.getState();
    if (currentState === 'OPEN') {
      return fallback;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch {
      this.recordFailure();
      return fallback;
    }
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}

/**
 * Execute telemetry logic safely without allowing any exception to bubble up into domain callers.
 */
export function safeTelemetryExecution<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
