import { describe, it, expect, beforeEach } from 'vitest';
import { VersionResolver } from '../../src/api/versioning/VersionResolver.js';
import { ApiCompatibility } from '../../src/api/versioning/ApiCompatibility.js';
import { ApiService } from '../../src/api/services/ApiService.js';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { ApiError } from '../../src/api/errors/ApiError.js';

describe('API Versioning and Compatibility', () => {
  let resolver: VersionResolver;
  let compatibility: ApiCompatibility;
  let requestService: RequestService;

  beforeEach(() => {
    resolver = new VersionResolver();
    compatibility = new ApiCompatibility();
    requestService = new RequestService();
  });

  it('resolves version from URL path prefix', () => {
    const res = resolver.resolve('/api/v1/context', {});
    expect(res.version).toBe('v1');
    expect(res.isSupported).toBe(true);
    expect(res.source).toBe('path');
  });

  it('resolves version from X-API-Version header', () => {
    const res = resolver.resolve('/context', { 'x-api-version': 'v1' });
    expect(res.version).toBe('v1');
    expect(res.isSupported).toBe(true);
    expect(res.source).toBe('header');
  });

  it('normalizes numeric version string to v-prefix', () => {
    const res = resolver.resolve('/context', { 'x-api-version': '1' });
    expect(res.version).toBe('v1');
  });

  it('resolves version from Accept header vendor mime type', () => {
    const res = resolver.resolve('/context', {
      accept: 'application/vnd.projectmind.v1+json',
    });
    expect(res.version).toBe('v1');
    expect(res.source).toBe('accept');
  });

  it('falls back to default supported version when no version specified', () => {
    const res = resolver.resolve('/context', {});
    expect(res.version).toBe('v1');
    expect(res.source).toBe('default');
  });

  it('identifies unsupported versions and ApiService rejects them with 400', async () => {
    const res = resolver.resolve('/api/v99/context', {});
    expect(res.isSupported).toBe(false);

    const router = new ApiRouter();
    router.get('/api/v99/context', async (req) => ({
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
      path: '/api/v99/context',
      method: 'GET',
    });

    const response = await apiService.handle(req);
    expect(response.status).toBe(400);
    const errData = response.data as any;
    expect(errData.code).toBe('UNSUPPORTED_VERSION');
    expect(errData.detail).toContain('v99');
  });

  it('attaches deprecation headers when a version is deprecated', () => {
    compatibility.registerDeprecation({
      version: 'v0',
      deprecatedSince: '2026-01-01',
      sunsetDate: '2026-12-31',
      migrationGuideUrl: 'https://docs.projectmind.ai/api/v0-to-v1',
    });

    const headers = compatibility.getDeprecationHeaders('v0');
    expect(headers['Deprecation']).toBe('true');
    expect(headers['Sunset']).toBe('2026-12-31');
    expect(headers['Link']).toContain('rel="deprecation"');
  });
});
