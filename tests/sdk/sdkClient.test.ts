import { describe, it, expect, vi } from 'vitest';
import { ProjectMindClient } from '../../src/sdk/ProjectMindClient.js';
import {
  SDKError,
  AuthenticationError,
  SecurityError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  TimeoutError,
} from '../../src/sdk/errors/SDKError.js';

describe('Phase 9.8 — Developer SDK and HTTP Client Safety', () => {
  it('22. should initialize ProjectMindClient with required options', () => {
    const client = new ProjectMindClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      workspaceId: 'ws-sdk-test',
    });

    expect(client.context).toBeDefined();
    expect(client.features).toBeDefined();
    expect(client.plans).toBeDefined();
    expect(client.feedback).toBeDefined();
    expect(client.plugins).toBeDefined();
  });

  it('23. should map HTTP error status codes to typed SDK errors', async () => {
    const makeClientWithStatus = (status: number, body: any = {}) => {
      const mockFetch = vi.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
      })) as any;

      return new ProjectMindClient({
        baseUrl: 'http://localhost:3000',
        workspaceId: 'ws-test',
        customFetch: mockFetch,
        maxRetries: 0,
      });
    };

    // 401 AuthenticationError
    const authClient = makeClientWithStatus(401, { message: 'Invalid token' });
    await expect(authClient.features.get('feat-1')).rejects.toThrow(AuthenticationError);

    // 403 SecurityError
    const secClient = makeClientWithStatus(403, { message: 'Access denied' });
    await expect(secClient.features.get('feat-1')).rejects.toThrow(SecurityError);

    // 404 NotFoundError
    const nfClient = makeClientWithStatus(404, { message: 'Not found' });
    await expect(nfClient.features.get('feat-missing')).rejects.toThrow(NotFoundError);

    // 429 RateLimitError
    const rlClient = makeClientWithStatus(429, { message: 'Rate exceeded' });
    await expect(rlClient.features.get('feat-1')).rejects.toThrow(RateLimitError);

    // 400 ValidationError
    const valClient = makeClientWithStatus(400, { message: 'Bad request', validationErrors: ['Field missing'] });
    await expect(valClient.features.get('feat-1')).rejects.toThrow(ValidationError);
  });

  it('24. should retry idempotent GET requests with exponential backoff on 503', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service Unavailable' }),
          text: async () => 'Service Unavailable',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'feat-retry', name: 'Feature Retry' }),
      };
    }) as any;

    const client = new ProjectMindClient({
      baseUrl: 'http://localhost:3000',
      workspaceId: 'ws-test',
      customFetch: mockFetch,
      maxRetries: 3,
    });

    const feat = await client.features.get('feat-retry');
    expect(feat.id).toBe('feat-retry');
    expect(callCount).toBe(3);
  });

  it('25. should NOT retry non-idempotent POST operations on failure to prevent duplicate mutations', async () => {
    let postCallCount = 0;
    const mockFetch = vi.fn(async () => {
      postCallCount++;
      return {
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service Unavailable' }),
        text: async () => 'Service Unavailable',
      };
    }) as any;

    const client = new ProjectMindClient({
      baseUrl: 'http://localhost:3000',
      workspaceId: 'ws-test',
      customFetch: mockFetch,
      maxRetries: 3,
    });

    // Submitting feedback is non-idempotent mutation
    await expect(
      client.feedback.submit({
        feedbackType: 'CONTEXT_USEFUL',
        targetType: 'FILE',
        targetId: 'src/app.ts',
        signal: 'POSITIVE',
      })
    ).rejects.toThrow(SDKError);

    // Exactly 1 call, no retries
    expect(postCallCount).toBe(1);
  });
});
