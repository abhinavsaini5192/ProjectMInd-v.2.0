import type { ApiMiddleware } from './ApiMiddleware.js';
import type { IRateLimiter } from '../ratelimit/IRateLimiter.js';
import { DEFAULT_RATE_LIMIT_POLICY, type RateLimitPolicy } from '../ratelimit/RateLimitPolicy.js';
import { ApiError } from '../errors/ApiError.js';

export interface RateLimitMiddlewareOptions {
  readonly rateLimiter: IRateLimiter;
  readonly policy?: RateLimitPolicy | undefined;
}

export function createRateLimitMiddleware(
  optionsOrLimiter: RateLimitMiddlewareOptions | IRateLimiter,
  optionalPolicy?: RateLimitPolicy
): ApiMiddleware {
  const rateLimiter = 'checkLimit' in optionsOrLimiter
    ? optionsOrLimiter
    : optionsOrLimiter.rateLimiter;
  const policy = ('checkLimit' in optionsOrLimiter
    ? optionalPolicy
    : optionsOrLimiter.policy) ?? DEFAULT_RATE_LIMIT_POLICY;

  return async (request, next) => {
    const key = policy.keyGenerator
      ? policy.keyGenerator(request)
      : request.context.principal?.principalId || request.context.clientIp || 'anonymous';

    const result = await rateLimiter.checkLimit(key, policy);

    if (!result.allowed) {
      throw ApiError.rateLimited(
        `Rate limit exceeded. Maximum ${policy.limit} requests per ${policy.windowMs / 1000}s.`,
        result.retryAfterSeconds
      );
    }

    const response = await next();

    // Attach rate limit headers to response metadata
    return {
      ...response,
      meta: {
        ...response.meta,
        rateLimit: {
          limit: result.limit,
          remaining: result.remaining,
          reset: Math.ceil(result.resetMs / 1000),
        },
      },
    };
  };
}
