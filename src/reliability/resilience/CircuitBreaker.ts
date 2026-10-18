export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  readonly failureThreshold?: number | undefined;
  readonly recoveryTimeoutMs?: number | undefined;
  readonly halfOpenProbeCount?: number | undefined;
}

export class CircuitOpenError extends Error {
  constructor(public readonly circuitName: string, public readonly resetAt: number) {
    super(`Circuit breaker '${circuitName}' is OPEN. Requests blocked until ${new Date(resetAt).toISOString()}`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private nextProbeAt = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly halfOpenProbeCount: number;

  constructor(public readonly name: string, options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 30000;
    this.halfOpenProbeCount = options.halfOpenProbeCount ?? 2;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextProbeAt) {
      this.state = 'HALF_OPEN';
      this.consecutiveSuccesses = 0;
    }
    return this.state;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitOpenError(this.name, this.nextProbeAt);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  public trip(): void {
    this.state = 'OPEN';
    this.nextProbeAt = Date.now() + this.recoveryTimeoutMs;
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.nextProbeAt = 0;
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.halfOpenProbeCount) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  private onFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.trip();
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.trip();
      }
    }
  }
}
