import { EventEmitter } from 'node:events';
import type { DistributedLock } from '../models/DistributedLock.js';
import type {
  IDistributedCoordinationBackend,
  BackendHealth,
  BackendSubscription,
} from './IDistributedCoordinationBackend.js';

interface MemoryKV {
  value: string;
  expiresAt: number | null;
}

export class MemoryCoordinationBackend implements IDistributedCoordinationBackend {
  private readonly locks = new Map<string, DistributedLock>();
  private readonly store = new Map<string, MemoryKV>();
  private readonly bus = new EventEmitter();
  private globalFencingCounter = 0;
  private isClosed = false;

  constructor() {
    this.bus.setMaxListeners(100);
  }

  public async acquireLock(
    key: string,
    ownerId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>
  ): Promise<DistributedLock | null> {
    if (this.isClosed) throw new Error('Coordination backend is closed');

    const now = Date.now();
    const existing = this.locks.get(key);

    if (existing) {
      if (existing.expiresAt > now) {
        // Still held by another or self
        if (existing.ownerId === ownerId) {
          // Re-entry / renewal by same owner
          const renewed: DistributedLock = {
            ...existing,
            expiresAt: now + ttlMs,
            renewCount: existing.renewCount + 1,
            ttlMs,
            metadata: metadata ?? existing.metadata,
          };
          this.locks.set(key, renewed);
          return renewed;
        }
        return null;
      }
      // Expired lock: treat as available
      this.locks.delete(key);
    }

    this.globalFencingCounter += 1;
    const lock: DistributedLock = {
      lockKey: key,
      ownerId,
      fencingToken: this.globalFencingCounter,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      ttlMs,
      renewCount: 0,
      metadata,
    };

    this.locks.set(key, lock);
    return lock;
  }

  public async renewLock(
    key: string,
    ownerId: string,
    fencingToken: number,
    ttlMs: number
  ): Promise<boolean> {
    if (this.isClosed) return false;

    const now = Date.now();
    const existing = this.locks.get(key);
    if (!existing) return false;

    // Reject if expired
    if (existing.expiresAt <= now) {
      this.locks.delete(key);
      return false;
    }

    // Reject if owner or fencing token does not match
    if (existing.ownerId !== ownerId || existing.fencingToken !== fencingToken) {
      return false;
    }

    const renewed: DistributedLock = {
      ...existing,
      expiresAt: now + ttlMs,
      renewCount: existing.renewCount + 1,
      ttlMs,
    };

    this.locks.set(key, renewed);
    return true;
  }

  public async releaseLock(
    key: string,
    ownerId: string,
    fencingToken: number
  ): Promise<boolean> {
    if (this.isClosed) return false;

    const existing = this.locks.get(key);
    if (!existing) return false;

    if (existing.ownerId !== ownerId || existing.fencingToken !== fencingToken) {
      return false;
    }

    this.locks.delete(key);
    return true;
  }

  public async inspectLock(key: string): Promise<DistributedLock | null> {
    const existing = this.locks.get(key);
    if (!existing) return null;

    if (existing.expiresAt <= Date.now()) {
      this.locks.delete(key);
      return null;
    }

    return existing;
  }

  public async forceRelease(key: string): Promise<boolean> {
    return this.locks.delete(key);
  }

  public async setNx(key: string, value: string, ttlMs?: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (existing && (existing.expiresAt === null || existing.expiresAt > now)) {
      return false;
    }

    this.store.set(key, {
      value,
      expiresAt: ttlMs ? now + ttlMs : null,
    });
    return true;
  }

  public async set(key: string, value: string, ttlMs?: number): Promise<void> {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? now + ttlMs : null,
    });
  }

  public async get(key: string): Promise<string | null> {
    const existing = this.store.get(key);
    if (!existing) return null;

    if (existing.expiresAt !== null && existing.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return existing.value;
  }

  public async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  public async listKeys(prefix: string): Promise<string[]> {
    const now = Date.now();
    const results: string[] = [];

    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt !== null && item.expiresAt <= now) {
        this.store.delete(key);
        continue;
      }
      if (key.startsWith(prefix)) {
        results.push(key);
      }
    }

    return results;
  }

  public async publish(channel: string, message: string): Promise<number> {
    if (this.isClosed) return 0;
    const count = this.bus.listenerCount(channel);
    this.bus.emit(channel, message);
    return count;
  }

  public async subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<BackendSubscription> {
    if (this.isClosed) throw new Error('Coordination backend is closed');

    this.bus.on(channel, handler);
    return {
      unsubscribe: async () => {
        this.bus.off(channel, handler);
      },
    };
  }

  public async healthCheck(): Promise<BackendHealth> {
    return {
      healthy: !this.isClosed,
      message: this.isClosed ? 'Memory backend is closed' : 'Memory coordination backend operational',
      latencyMs: 0,
    };
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    this.locks.clear();
    this.store.clear();
    this.bus.removeAllListeners();
  }
}
