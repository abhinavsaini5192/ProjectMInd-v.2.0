import type { ContextResponse } from '../models/ContextResponse.js';

interface CacheEntry {
  response: ContextResponse;
  expiresAt: number;
  repositoryId: string;
}

export class ContextCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public get(key: string): ContextResponse | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.response;
  }

  public set(key: string, response: ContextResponse, repositoryId: string, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, {
      response,
      expiresAt,
      repositoryId,
    });
  }

  public invalidateRepository(repositoryId: string): void {
    for (const [k, v] of this.store.entries()) {
      if (v.repositoryId === repositoryId) {
        this.store.delete(k);
      }
    }
  }

  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }
}
