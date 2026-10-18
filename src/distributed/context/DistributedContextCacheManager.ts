import type { IDistributedLockManager } from '../locking/IDistributedLockManager.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';

export interface CacheEntry<T> {
  readonly value: T;
  readonly computedAt: number;
  readonly expiresAt: number;
}

export class DistributedContextCacheManager {
  private readonly lockManager: IDistributedLockManager;
  private readonly eventBus?: IEventBus | undefined;
  private readonly localCache = new Map<string, CacheEntry<any>>();

  constructor(lockManager: IDistributedLockManager, eventBus?: IEventBus) {
    this.lockManager = lockManager;
    this.eventBus = eventBus;

    // Listen for cluster invalidation events
    if (this.eventBus) {
      this.eventBus.subscribe('context:cache:invalidate', (event: any) => {
        const key = event?.payload?.key ?? event?.key;
        const prefix = event?.payload?.prefix ?? event?.prefix;

        if (typeof key === 'string') {
          this.localCache.delete(key);
        } else if (typeof prefix === 'string') {
          for (const k of this.localCache.keys()) {
            if (k.startsWith(prefix)) this.localCache.delete(k);
          }
        }
      });
    }
  }

  /**
   * Retrieves a cached value or generates it under a distributed lock to prevent cache stampedes.
   */
  public async getOrCompute<T>(
    cacheKey: string,
    computeFn: () => Promise<T>,
    ttlMs: number = 60000
  ): Promise<T> {
    const now = Date.now();
    const existing = this.localCache.get(cacheKey);

    if (existing && existing.expiresAt > now) {
      return existing.value as T;
    }

    // Protect against cache stampede across instances
    const lockKey = `stampede:context:${cacheKey}`;
    return this.lockManager.withLock(
      lockKey,
      async () => {
        // Double check cache after acquiring lock
        const secondCheck = this.localCache.get(cacheKey);
        if (secondCheck && secondCheck.expiresAt > Date.now()) {
          return secondCheck.value as T;
        }

        const computed = await computeFn();
        this.localCache.set(cacheKey, {
          value: computed,
          computedAt: Date.now(),
          expiresAt: Date.now() + ttlMs,
        });

        return computed;
      },
      { ttlMs: 15000, waitTimeoutMs: 10000 }
    );
  }

  /**
   * Invalidates a cache key locally and broadcasts invalidation across the cluster.
   */
  public invalidate(cacheKey: string): void {
    this.localCache.delete(cacheKey);
    this.eventBus?.publish('context:cache:invalidate', { key: cacheKey });
  }

  /**
   * Clears the entire local cache and broadcasts cluster clear.
   */
  public clear(): void {
    this.localCache.clear();
    this.eventBus?.publish('context:cache:invalidate', { prefix: '' });
  }
}
