import { describe, it, expect, beforeEach } from 'vitest';
import { ApiError } from '../../src/api/errors/ApiError.js';
import { ApiErrorMapper } from '../../src/api/errors/ApiErrorMapper.js';
import { ApiService } from '../../src/api/services/ApiService.js';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import type { TelemetryRecord } from '../../src/api/middleware/TelemetryMiddleware.js';

describe('API Error Contract and Observability', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let telemetryRecords: TelemetryRecord[];

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();
    telemetryRecords = [];
  });

  describe('RFC 7807 Problem Details Error Contract', () => {
    it('formats ApiError to standard RFC 7807 structure', () => {
      const err = new ApiError({
        code: 'VALIDATION_FAILED',
        message: 'Request payload failed schema validation',
        detail: 'The field "query" must not be empty.',
        instance: '/v1/context/orchestrate',
        requestId: 'req-abc',
        correlationId: 'corr-xyz',
        errors: [{ field: 'query', message: 'Required' }],
      });

      const json = err.toJSON();
      expect(json.type).toBe('urn:projectmind:error:validation_failed');
      expect(json.title).toBe('Request payload failed schema validation');
      expect(json.status).toBe(422);
      expect(json.detail).toBe('The field "query" must not be empty.');
      expect(json.code).toBe('VALIDATION_FAILED');
      expect(json.instance).toBe('/v1/context/orchestrate');
      expect(json.requestId).toBe('req-abc');
      expect(json.correlationId).toBe('corr-xyz');
      expect(json.errors?.length).toBe(1);
    });

    it('ApiErrorMapper maps generic domain errors into canonical ApiError', () => {
      const authErr = new Error('User unauthenticated: missing bearer token');
      const mappedAuth = ApiErrorMapper.map(authErr, { requestId: 'r-1', correlationId: 'c-1' });
      expect(mappedAuth.code).toBe('UNAUTHENTICATED');
      expect(mappedAuth.status).toBe(401);

      const notFoundErr = new Error('Feature feat_123 not found in registry');
      const mappedNotFound = ApiErrorMapper.map(notFoundErr);
      expect(mappedNotFound.code).toBe('NOT_FOUND');
      expect(mappedNotFound.status).toBe(404);

      const conflictErr = new Error('Resource already exists with hash abc');
      const mappedConflict = ApiErrorMapper.map(conflictErr);
      expect(mappedConflict.code).toBe('CONFLICT');
      expect(mappedConflict.status).toBe(409);
    });
  });

  describe('Observability and Correlation Tracking', () => {
    it('preserves inbound correlation-id across the entire request/response lifecycle', async () => {
      router.get('/v1/test-corr', async (req) => ({
        status: 200,
        data: { message: 'hello' },
        meta: {
          requestId: req.context.requestId,
          correlationId: req.context.correlationId,
          apiVersion: req.context.apiVersion,
          timestamp: Date.now(),
        },
      }));

      const apiService = new ApiService({
        router,
        telemetryCollector: (record) => telemetryRecords.push(record),
      });

      const inboundCorrelationId = 'client-trace-999-abc';
      const req = requestService.createRequest({
        path: '/v1/test-corr',
        method: 'GET',
        headers: {
          'x-correlation-id': inboundCorrelationId,
        },
      });

      const res = await apiService.handle(req);
      expect(res.status).toBe(200);
      expect(res.meta.correlationId).toBe(inboundCorrelationId);
      expect(res.meta.requestId).toBeDefined();
      expect(res.meta.durationMs).toBeGreaterThanOrEqual(0);

      // Verify telemetry record was captured
      expect(telemetryRecords.length).toBe(1);
      const tel = telemetryRecords[0]!;
      expect(tel.correlationId).toBe(inboundCorrelationId);
      expect(tel.statusCode).toBe(200);
      expect(tel.method).toBe('GET');
      expect(tel.path).toBe('/v1/test-corr');
    });

    it('generates unique correlation-id if none is supplied', async () => {
      router.get('/v1/test-gen', async (req) => ({
        status: 200,
        data: {},
        meta: {
          requestId: req.context.requestId,
          correlationId: req.context.correlationId,
          apiVersion: req.context.apiVersion,
          timestamp: Date.now(),
        },
      }));

      const apiService = new ApiService({ router });
      const req = requestService.createRequest({
        path: '/v1/test-gen',
        method: 'GET',
      });

      const res = await apiService.handle(req);
      expect(res.meta.correlationId).toBeDefined();
      expect(res.meta.correlationId.length).toBeGreaterThan(10);
      expect(res.meta.requestId).toBeDefined();
    });

    it('records telemetry and preserves correlation-id even on failure', async () => {
      router.get('/v1/fail-route', async () => {
        throw new Error('Downstream failure simulation');
      });

      const apiService = new ApiService({
        router,
        telemetryCollector: (rec) => telemetryRecords.push(rec),
      });

      const req = requestService.createRequest({
        path: '/v1/fail-route',
        method: 'GET',
        headers: {
          'x-correlation-id': 'fail-trace-123',
        },
      });

      const res = await apiService.handle(req);
      expect(res.status).toBe(500);
      expect(res.meta.correlationId).toBe('fail-trace-123');
      expect(telemetryRecords.length).toBe(1);
      expect(telemetryRecords[0]?.correlationId).toBe('fail-trace-123');
    });
  });
});
