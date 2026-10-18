interface CachedEntry {
  readonly result: unknown;
  readonly expiresAt: number;
}

export class ToolIdempotencyManager {
  private readonly cache = new Map<string, CachedEntry>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 10 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public has(operationId: string): boolean {
    const entry = this.cache.get(operationId);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(operationId);
      return false;
    }
    return true;
  }

  public get(operationId: string): unknown | undefined {
    const entry = this.cache.get(operationId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(operationId);
      return undefined;
    }
    return entry.result;
  }

  public set(operationId: string, result: unknown, ttlMs: number = this.defaultTtlMs): void {
    this.cache.set(operationId, {
      result,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public clear(): void {
    this.cache.clear();
  }
}
