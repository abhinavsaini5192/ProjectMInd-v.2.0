import type { IRateLimiter, RateLimitResult } from './IRateLimiter.js';
import { DEFAULT_RATE_LIMIT_POLICY, type RateLimitPolicy } from './RateLimitPolicy.js';

export class InMemoryRateLimiter implements IRateLimiter {
  private readonly records: Map<string, number[]> = new Map();

  public async checkLimit(
    key: string,
    policy: RateLimitPolicy = DEFAULT_RATE_LIMIT_POLICY
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - policy.windowMs;

    let timestamps = this.records.get(key);
    if (!timestamps) {
      timestamps = [];
      this.records.set(key, timestamps);
    }

    // Purge expired timestamps outside the sliding window
    timestamps = timestamps.filter((t) => t > windowStart);
    this.records.set(key, timestamps);

    if (timestamps.length >= policy.limit) {
      const oldestInWindow = timestamps[0] ?? now;
      const resetMs = oldestInWindow + policy.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - now) / 1000));

      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        resetMs,
        retryAfterSeconds,
      };
    }

    // Allow request and record timestamp
    timestamps.push(now);
    const resetMs = timestamps[0]! + policy.windowMs;

    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - timestamps.length),
      resetMs,
    };
  }

  public async reset(key: string): Promise<void> {
    this.records.delete(key);
  }

  public async clear(): Promise<void> {
    this.records.clear();
  }
}
