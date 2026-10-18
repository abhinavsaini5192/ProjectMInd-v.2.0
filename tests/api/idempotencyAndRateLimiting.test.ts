import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryIdempotencyStore } from '../../src/api/idempotency/InMemoryIdempotencyStore.js';
import { IdempotencyService } from '../../src/api/idempotency/IdempotencyService.js';
import { createIdempotencyMiddleware } from '../../src/api/middleware/IdempotencyMiddleware.js';
import { InMemoryRateLimiter } from '../../src/api/ratelimit/InMemoryRateLimiter.js';
import { createRateLimitMiddleware } from '../../src/api/middleware/RateLimitMiddleware.js';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { ApiError } from '../../src/api/errors/ApiError.js';

describe('API Idempotency and Rate Limiting', () => {
  let store: InMemoryIdempotencyStore;
  let service: IdempotencyService;
  let router: ApiRouter;
  let requestService: RequestService;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
    service = new IdempotencyService(store);
    router = new ApiRouter();
    requestService = new RequestService();
  });

  describe('Idempotency', () => {
    it('executes mutation on first call and replays cached response on second call', async () => {
      let mutationCount = 0;
      const idempotencyMiddleware = createIdempotencyMiddleware({ idempotencyService: service });

      router.post(
        '/v1/mutations',
        async (req) => {
          mutationCount++;
          return {
            status: 201,
            data: { result: 'mutation_done', count: mutationCount },
            meta: {
              requestId: req.context.requestId,
              correlationId: req.context.correlationId,
              apiVersion: req.context.apiVersion,
              timestamp: Date.now(),
            },
          };
        },
        { middlewares: [idempotencyMiddleware] }
      );

      const req1 = requestService.createRequest({
        path: '/v1/mutations',
        method: 'POST',
        headers: {
          'idempotency-key': 'key-unique-123',
        },
        body: { amount: 100 },
      });

      const res1 = await router.handle(req1);
      expect(res1.status).toBe(201);
      expect((res1.data as any).count).toBe(1);
      expect(mutationCount).toBe(1);

      // Replay identical request
      const req2 = requestService.createRequest({
        path: '/v1/mutations',
        method: 'POST',
        headers: {
          'idempotency-key': 'key-unique-123',
        },
        body: { amount: 100 },
      });

      const res2 = await router.handle(req2);
      expect(res2.status).toBe(201);
      expect((res2.data as any).count).toBe(1); // Replayed, not re-executed
      expect(mutationCount).toBe(1);
      expect(res2.headers?.['idempotent-replayed']).toBe('true');
    });

    it('rejects key reuse with different payload with 409 CONFLICT', async () => {
      await service.beginOperation('key-payload-test', 'user-1', '/v1/tasks', { title: 'original' });
      await service.completeOperation('key-payload-test', 200, {}, { success: true });

      await expect(
        service.beginOperation('key-payload-test', 'user-1', '/v1/tasks', { title: 'tampered' })
      ).rejects.toThrow(ApiError);

      try {
        await service.beginOperation('key-payload-test', 'user-1', '/v1/tasks', { title: 'tampered' });
      } catch (e: any) {
        expect(e.code).toBe('CONFLICT');
        expect(e.status).toBe(409);
      }
    });

    it('rejects key reuse by a different principal with 403 FORBIDDEN', async () => {
      await service.beginOperation('shared-key-test', 'user-original', '/v1/tasks', {});
      await service.completeOperation('shared-key-test', 200, {}, {});

      await expect(
        service.beginOperation('shared-key-test', 'attacker-user', '/v1/tasks', {})
      ).rejects.toThrow(ApiError);

      try {
        await service.beginOperation('shared-key-test', 'attacker-user', '/v1/tasks', {});
      } catch (e: any) {
        expect(e.code).toBe('FORBIDDEN');
        expect(e.status).toBe(403);
      }
    });

    it('detects concurrent duplicate in-flight requests and throws 409 IDEMPOTENCY_CONFLICT', async () => {
      await service.beginOperation('concurrent-key', 'user-1', '/v1/tasks', {});

      await expect(
        service.beginOperation('concurrent-key', 'user-1', '/v1/tasks', {})
      ).rejects.toThrow(ApiError);

      try {
        await service.beginOperation('concurrent-key', 'user-1', '/v1/tasks', {});
      } catch (e: any) {
        expect(e.code).toBe('IDEMPOTENCY_CONFLICT');
        expect(e.status).toBe(409);
      }
    });

    it('allows retry after failed operation', async () => {
      await service.beginOperation('retry-key', 'user-1', '/v1/tasks', { id: 1 });
      await service.failOperation('retry-key', new Error('Downstream DB error'));

      const retryCheck = await service.beginOperation('retry-key', 'user-1', '/v1/tasks', { id: 1 });
      expect(retryCheck.isReplay).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('enforces rate limit and rejects excess requests with 429 RATE_LIMITED', async () => {
      const rateLimiter = new InMemoryRateLimiter();
      const rateLimitPolicy = {
        name: 'test_limit',
        limit: 3,
        windowMs: 60000,
        keyGenerator: () => 'fixed-test-client',
      };

      const mw = createRateLimitMiddleware(rateLimiter, rateLimitPolicy);

      router.get(
        '/v1/limited',
        async (req) => ({
          status: 200,
          data: { ok: true },
          meta: {
            requestId: req.context.requestId,
            correlationId: req.context.correlationId,
            apiVersion: req.context.apiVersion,
            timestamp: Date.now(),
          },
        }),
        { middlewares: [mw] }
      );

      const makeReq = () =>
        requestService.createRequest({
          path: '/v1/limited',
          method: 'GET',
        });

      // 3 requests allowed
      await router.handle(makeReq());
      await router.handle(makeReq());
      await router.handle(makeReq());

      // 4th request must be rate limited
      await expect(router.handle(makeReq())).rejects.toThrow(ApiError);
      try {
        await router.handle(makeReq());
      } catch (e: any) {
        expect(e.code).toBe('RATE_LIMITED');
        expect(e.status).toBe(429);
        expect(e.retryAfter).toBeGreaterThan(0);
      }
    });
  });
});
