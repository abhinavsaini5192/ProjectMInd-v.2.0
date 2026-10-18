import type { RateLimitPolicy } from './RateLimitPolicy.js';

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetMs: number;
  readonly retryAfterSeconds?: number | undefined;
}

export interface IRateLimiter {
  checkLimit(key: string, policy?: RateLimitPolicy): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  clear(): Promise<void>;
}
