import { randomUUID } from 'crypto';
import type { ResourceLock, LockAcquisitionOptions } from '../models/ResourceLock.js';
import type { IResourceLockManager } from './IResourceLockManager.js';
import type { LockResult } from './LockResult.js';

export class ResourceLockManager implements IResourceLockManager {
  private readonly locksByKey = new Map<string, ResourceLock>();
  private readonly locksById = new Map<string, ResourceLock>();
  private readonly defaultTtlMs: number;
  private readonly maxTtlMs: number;

  constructor(options: { defaultTtlMs?: number; maxTtlMs?: number } = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 30000;
    this.maxTtlMs = options.maxTtlMs ?? 300000;
  }

  public static buildKey(
    workspaceId: string,
    repositoryId?: string,
    scope: string = 'global',
    operation?: string
  ): string {
    const parts = [`ws:${workspaceId}`];
    if (repositoryId) parts.push(`repo:${repositoryId}`);
    parts.push(`scope:${scope}`);
    if (operation) parts.push(`op:${operation}`);
    return parts.join(':');
  }

  public async acquire(
    resourceKey: string,
    ownerId: string,
    options: LockAcquisitionOptions = {}
  ): Promise<LockResult> {
    if (!ownerId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const ttlMs = Math.min(options.ttlMs ?? this.defaultTtlMs, this.maxTtlMs);
    const waitTimeoutMs = options.waitTimeoutMs ?? 0;
    const deadline = Date.now() + waitTimeoutMs;

    let attempt = 0;
    while (true) {
      const now = Date.now();
      const existing = this.locksByKey.get(resourceKey);

      // Check if existing lock is active or expired
      if (existing) {
        if (existing.expiresAt <= now) {
          // Stale lock: clean it up
          this.locksByKey.delete(resourceKey);
          this.locksById.delete(existing.lockId);
        } else {
          // Actively locked by someone else (or self-reentry)
          if (existing.ownerId === ownerId) {
            // Re-entrant renewal by same owner
            const updated: ResourceLock = {
              ...existing,
              expiresAt: now + ttlMs,
              ttlMs,
            };
            this.locksByKey.set(resourceKey, updated);
            this.locksById.set(existing.lockId, updated);
            return { success: true, lock: updated };
          }

          if (now < deadline) {
            // Backoff wait with jitter
            attempt++;
            const delay = Math.min(500, Math.floor(Math.random() * Math.min(50 * Math.pow(1.5, attempt), 200)) + 20);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          return {
            success: false,
            error: waitTimeoutMs > 0 ? 'TIMEOUT' : 'LOCK_CONTENDED',
            currentOwner: existing.ownerId,
            remainingTtlMs: existing.expiresAt - now,
          };
        }
      }

      // Lock is free: acquire it
      const lockId = `lock-${randomUUID()}`;
      const newLock: ResourceLock = {
        lockId,
        resourceKey,
        ownerId,
        acquiredAt: now,
        expiresAt: now + ttlMs,
        ttlMs,
        purpose: options.purpose ?? 'exclusive_operation',
        correlationId: options.correlationId,
        workspaceId: options.workspaceId ?? 'default',
        repositoryId: options.repositoryId,
        featureId: options.featureId,
      };

      this.locksByKey.set(resourceKey, newLock);
      this.locksById.set(lockId, newLock);
      return { success: true, lock: newLock };
    }
  }

  public async renew(lockId: string, ownerId: string, ttlMs?: number): Promise<boolean> {
    const existing = this.locksById.get(lockId);
    if (!existing) return false;

    const now = Date.now();
    if (existing.expiresAt <= now) {
      this.locksByKey.delete(existing.resourceKey);
      this.locksById.delete(lockId);
      return false;
    }

    if (existing.ownerId !== ownerId) {
      return false;
    }

    const duration = Math.min(ttlMs ?? existing.ttlMs, this.maxTtlMs);
    const updated: ResourceLock = {
      ...existing,
      expiresAt: now + duration,
      ttlMs: duration,
    };

    this.locksByKey.set(existing.resourceKey, updated);
    this.locksById.set(lockId, updated);
    return true;
  }

  public async release(lockId: string, ownerId: string): Promise<boolean> {
    const existing = this.locksById.get(lockId);
    if (!existing) return false;

    if (existing.ownerId !== ownerId) {
      return false;
    }

    this.locksById.delete(lockId);
    this.locksByKey.delete(existing.resourceKey);
    return true;
  }

  public async inspect(resourceKey: string): Promise<ResourceLock | null> {
    const lock = this.locksByKey.get(resourceKey);
    if (!lock) return null;

    if (lock.expiresAt <= Date.now()) {
      this.locksByKey.delete(resourceKey);
      this.locksById.delete(lock.lockId);
      return null;
    }

    return lock;
  }

  public async isLocked(resourceKey: string): Promise<boolean> {
    const lock = await this.inspect(resourceKey);
    return lock !== null;
  }

  public async forceRelease(resourceKey: string, _reason: string): Promise<boolean> {
    const existing = this.locksByKey.get(resourceKey);
    if (!existing) return false;

    this.locksByKey.delete(resourceKey);
    this.locksById.delete(existing.lockId);
    return true;
  }

  public async getActiveLocks(): Promise<ResourceLock[]> {
    const now = Date.now();
    const active: ResourceLock[] = [];
    for (const [key, lock] of this.locksByKey.entries()) {
      if (lock.expiresAt > now) {
        active.push(lock);
      } else {
        this.locksByKey.delete(key);
        this.locksById.delete(lock.lockId);
      }
    }
    return active;
  }

  public async purgeExpired(): Promise<string[]> {
    const now = Date.now();
    const purged: string[] = [];
    for (const [key, lock] of this.locksByKey.entries()) {
      if (lock.expiresAt <= now) {
        this.locksByKey.delete(key);
        this.locksById.delete(lock.lockId);
        purged.push(key);
      }
    }
    return purged;
  }
}
