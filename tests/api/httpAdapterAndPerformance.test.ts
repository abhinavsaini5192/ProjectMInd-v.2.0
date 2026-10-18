import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { ApiService } from '../../src/api/services/ApiService.js';
import { HttpAdapter } from '../../src/api/adapters/HttpAdapter.js';
import { OpenApiGenerator } from '../../src/api/documentation/OpenApiGenerator.js';

describe('HTTP Adapter and API Performance', () => {
  let router: ApiRouter;
  let apiService: ApiService;
  let adapter: HttpAdapter;
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    router = new ApiRouter();
    router.get('/v1/hello', async (req) => ({
      status: 200,
      headers: { 'x-custom-test': 'ok' },
      data: { message: 'hello world' },
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }));

    router.post('/v1/echo', async (req) => ({
      status: 201,
      data: req.body,
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }));

    router.delete('/v1/empty', async (req) => ({
      status: 204,
      data: null,
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }));

    apiService = new ApiService({ router });
    adapter = new HttpAdapter(apiService, { maxBodySizeBytes: 1024 * 64 }); // 64KB for test

    server = adapter.createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('serves GET request over real HTTP socket with correct headers and JSON envelope', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/hello`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('x-custom-test')).toBe('ok');

    const json = await res.json();
    expect(json.data.message).toBe('hello world');
    expect(json.meta.requestId).toBeDefined();
    expect(json.meta.apiVersion).toBe('v1');
  });

  it('serves POST request with JSON payload over HTTP', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/echo`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': 'client-corr-id-777',
      },
      body: JSON.stringify({ item: 'ProjectMind Unit Test' }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.item).toBe('ProjectMind Unit Test');
    expect(json.meta.correlationId).toBe('client-corr-id-777');
  });

  it('handles 204 No Content responses properly', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/empty`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe('');
  });

  it('rejects malformed JSON with 400 Bad Request Problem Details', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ broken json: true ',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.type).toContain('bad_request');
    expect(json.title).toContain('Malformed JSON');
  });

  it('generates complete OpenAPI 3.1 specification from registered router', () => {
    const spec = OpenApiGenerator.generate(router);

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toContain('ProjectMind');
    expect(spec.paths['/v1/hello']?.['get']).toBeDefined();
    expect(spec.paths['/v1/echo']?.['post']).toBeDefined();
    expect(spec.components.schemas['ApiMetadata']).toBeDefined();
    expect(spec.components.schemas['ProblemDetails']).toBeDefined();
  });

  it('initializes API layer within tight performance boundary (< 100ms)', () => {
    const start = performance.now();
    const testRouter = new ApiRouter();
    const testService = new ApiService({ router: testRouter });
    const testAdapter = new HttpAdapter(testService);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(testAdapter).toBeDefined();
  });
});
