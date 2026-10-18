import type { ApiRequest } from '../contracts/ApiRequest.js';

export interface RateLimitPolicy {
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
  readonly keyGenerator?: (request: ApiRequest) => string;
}

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  name: 'default',
  limit: 120, // 120 requests per minute
  windowMs: 60 * 1000,
  keyGenerator: (req) => {
    // Principal ID or client IP or default
    return req.context.principal?.identityId || req.context.principal?.principalId || req.context.clientIp || 'anonymous';
  },
};
