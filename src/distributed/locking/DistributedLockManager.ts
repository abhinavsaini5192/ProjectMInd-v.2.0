import { randomUUID } from 'node:crypto';
import type { DistributedLock, LockAcquireOptions, LockAcquireResult } from '../models/DistributedLock.js';
import type { IDistributedCoordinationBackend } from '../coordination/IDistributedCoordinationBackend.js';
import type { IDistributedLockManager, LockMetrics } from './IDistributedLockManager.js';
import { FencingGuard } from './FencingGuard.js';

export interface DistributedLockManagerOptions {
  readonly ownerId?: string | undefined;
  readonly defaultTtlMs?: number | undefined;
  readonly defaultWaitTimeoutMs?: number | undefined;
  readonly defaultRetryIntervalMs?: number | undefined;
  readonly autoRenewIntervalFraction?: number | undefined; // Fraction of TTL (e.g. 0.5) to trigger auto-renewal
}

export class DistributedLockManager implements IDistributedLockManager {
  private readonly backend: IDistributedCoordinationBackend;
  private readonly ownerId: string;
  private readonly defaultTtlMs: number;
  private readonly defaultWaitTimeoutMs: number;
  private readonly defaultRetryIntervalMs: number;
  private readonly autoRenewFraction: number;
  private readonly fencingGuard: FencingGuard;
  private readonly heldLocks = new Map<string, { lock: DistributedLock; renewTimer?: NodeJS.Timeout }>();

  // Metrics
  private totalAttempts = 0;
  private successfulAcquisitions = 0;
  private failedAcquisitions = 0;
  private totalRenewals = 0;
  private totalReleases = 0;
  private totalLatencyMs = 0;

  constructor(
    backend: IDistributedCoordinationBackend,
    options: DistributedLockManagerOptions = {},
    fencingGuard?: FencingGuard
  ) {
    this.backend = backend;
    this.ownerId = options.ownerId ?? `node-${process.pid}-${randomUUID().slice(0, 8)}`;
    this.defaultTtlMs = options.defaultTtlMs ?? 30000;
    this.defaultWaitTimeoutMs = options.defaultWaitTimeoutMs ?? 10000;
    this.defaultRetryIntervalMs = options.defaultRetryIntervalMs ?? 100;
    this.autoRenewFraction = options.autoRenewIntervalFraction ?? 0.5;
    this.fencingGuard = fencingGuard ?? new FencingGuard();
  }

  public getFencingGuard(): FencingGuard {
    return this.fencingGuard;
  }

  public getOwnerId(): string {
    return this.ownerId;
  }

  public async acquire(
    resourceKey: string,
    options: LockAcquireOptions = {}
  ): Promise<LockAcquireResult> {
    const startTime = Date.now();
    this.totalAttempts++;

    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const waitTimeoutMs = options.waitTimeoutMs ?? this.defaultWaitTimeoutMs;
    const retryIntervalMs = options.retryIntervalMs ?? this.defaultRetryIntervalMs;
    const deadline = startTime + waitTimeoutMs;

    let attempt = 0;
    let lastSeenLock: DistributedLock | null = null;

    while (true) {
      attempt++;
      try {
        const acquired = await this.backend.acquireLock(
          resourceKey,
          this.ownerId,
          ttlMs,
          options.metadata as Record<string, unknown>
        );

        if (acquired) {
          const latency = Date.now() - startTime;
          this.successfulAcquisitions++;
          this.totalLatencyMs += latency;

          // Record fencing token
          this.fencingGuard.recordToken(resourceKey, acquired.fencingToken);

          // Track held lock
          this.heldLocks.set(resourceKey, { lock: acquired });

          return { success: true, lock: acquired };
        }

        // Lock is held by someone else: inspect current holder
        lastSeenLock = await this.backend.inspectLock(resourceKey);
      } catch (err) {
        // Backend error during acquisition attempt
        lastSeenLock = null;
      }

      const now = Date.now();
      if (now >= deadline) {
        this.failedAcquisitions++;
        return {
          success: false,
          error: `Lock acquisition timed out after ${now - startTime}ms on resource '${resourceKey}'. Currently held by: ${lastSeenLock?.ownerId ?? 'unknown'}`,
          currentLock: lastSeenLock,
        };
      }

      // Calculate jittered exponential backoff (capped at 500ms)
      const baseDelay = Math.min(retryIntervalMs * Math.pow(1.2, Math.min(attempt, 5)), 500);
      const jitter = Math.floor(Math.random() * 20);
      const delay = Math.min(baseDelay + jitter, deadline - now);

      await new Promise((resolve) => setTimeout(resolve, Math.max(delay, 5)));
    }
  }

  public async renew(lock: DistributedLock, extensionMs?: number): Promise<boolean> {
    const duration = extensionMs ?? lock.ttlMs;
    const renewed = await this.backend.renewLock(
      lock.lockKey,
      this.ownerId,
      lock.fencingToken,
      duration
    );

    if (renewed) {
      this.totalRenewals++;
      const current = this.heldLocks.get(lock.lockKey);
      if (current) {
        const updatedLock: DistributedLock = {
          ...current.lock,
          expiresAt: Date.now() + duration,
          renewCount: current.lock.renewCount + 1,
          ttlMs: duration,
        };
        current.lock = updatedLock;
      }
    }
    return renewed;
  }

  public async release(lock: DistributedLock): Promise<boolean> {
    const entry = this.heldLocks.get(lock.lockKey);
    if (entry?.renewTimer) {
      clearInterval(entry.renewTimer);
    }
    this.heldLocks.delete(lock.lockKey);

    const released = await this.backend.releaseLock(
      lock.lockKey,
      this.ownerId,
      lock.fencingToken
    );

    if (released) {
      this.totalReleases++;
    }
    return released;
  }

  public async withLock<T>(
    resourceKey: string,
    operation: (lock: DistributedLock) => Promise<T>,
    options: LockAcquireOptions = {}
  ): Promise<T> {
    const result = await this.acquire(resourceKey, options);
    if (!result.success) {
      throw new Error(`Failed to acquire lock for operation on '${resourceKey}': ${result.error}`);
    }

    const { lock } = result;

    // Start background auto-renewal loop if operation is long-running
    const renewIntervalMs = Math.floor(lock.ttlMs * this.autoRenewFraction);
    let isFinished = false;

    const renewTimer = setInterval(async () => {
      if (isFinished) return;
      try {
        await this.renew(lock);
      } catch {
        // Renewal failed (e.g. lease expired or backend issue)
      }
    }, renewIntervalMs);

    const entry = this.heldLocks.get(resourceKey);
    if (entry) {
      entry.renewTimer = renewTimer;
    }

    try {
      // Assert fencing token is currently valid before starting operation
      this.fencingGuard.assertValid(resourceKey, lock.fencingToken);

      const opResult = await operation(lock);

      // Re-assert fencing token hasn't been superseded during operation
      this.fencingGuard.assertValid(resourceKey, lock.fencingToken);

      return opResult;
    } finally {
      isFinished = true;
      clearInterval(renewTimer);
      try {
        await this.release(lock);
      } catch {
        // Safe release best effort
      }
    }
  }

  public async inspect(resourceKey: string): Promise<DistributedLock | null> {
    return this.backend.inspectLock(resourceKey);
  }

  public async isLocked(resourceKey: string): Promise<boolean> {
    const lock = await this.backend.inspectLock(resourceKey);
    return lock !== null && lock.expiresAt > Date.now();
  }

  public async forceRelease(resourceKey: string): Promise<boolean> {
    const entry = this.heldLocks.get(resourceKey);
    if (entry?.renewTimer) {
      clearInterval(entry.renewTimer);
    }
    this.heldLocks.delete(resourceKey);
    return this.backend.forceRelease(resourceKey);
  }

  public getMetrics(): LockMetrics {
    const totalSuccessful = this.successfulAcquisitions;
    const avgLatency = totalSuccessful > 0 ? this.totalLatencyMs / totalSuccessful : 0;

    return {
      totalAcquisitionAttempts: this.totalAttempts,
      successfulAcquisitions: totalSuccessful,
      failedAcquisitions: this.failedAcquisitions,
      totalRenewals: this.totalRenewals,
      totalReleases: this.totalReleases,
      averageAcquisitionLatencyMs: Math.round(avgLatency * 100) / 100,
      activeLocksCount: this.heldLocks.size,
    };
  }

  public async close(): Promise<void> {
    for (const [key, entry] of this.heldLocks.entries()) {
      if (entry.renewTimer) {
        clearInterval(entry.renewTimer);
      }
      try {
        await this.backend.releaseLock(key, this.ownerId, entry.lock.fencingToken);
      } catch {}
    }
    this.heldLocks.clear();
  }
}
