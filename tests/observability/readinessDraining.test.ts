import { describe, it, expect } from 'vitest';
import { PlatformHealthService } from '../../src/platform/health/PlatformHealthService.js';
import { HealthController } from '../../src/api/controllers/HealthController.js';
import type { ApiRequest } from '../../src/api/contracts/ApiRequest.js';

describe('Health, Readiness & Draining Diagnostics Suite', () => {
  const dummyRequest: ApiRequest = {
    method: 'GET',
    path: '/health/ready',
    headers: {},
    params: {},
    query: {},
    body: undefined,
    context: {
      requestId: 'req-test-health',
      correlationId: 'corr-test-health',
    } as any,
  };

  it('reports healthy and ready when all required dependencies are healthy', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'test');

    healthService.registerComponent(
      'DATABASE',
      async () => ({ status: 'HEALTHY', message: 'SQLite WAL ok' }),
      true
    );
    healthService.registerComponent(
      'REDIS',
      async () => ({ status: 'HEALTHY', message: 'Redis ping pong' }),
      true
    );

    const controller = new HealthController(healthService);

    const livenessResp = await controller.getLiveness(dummyRequest);
    expect(livenessResp.status).toBe(200);

    const readinessResp = await controller.getReadiness(dummyRequest);
    expect(readinessResp.status).toBe(200);
    expect((readinessResp.data as any).ready).toBe(true);

    const healthResp = await controller.getHealth(dummyRequest);
    expect(healthResp.status).toBe(200);
    expect((healthResp.data as any).status).toBe('HEALTHY');
  });

  it('fails readiness (HTTP 503) when a required dependency fails', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'test');

    healthService.registerComponent(
      'DATABASE',
      async () => ({ status: 'HEALTHY', message: 'DB up' }),
      true
    );
    healthService.registerComponent(
      'BROKER',
      async () => ({ status: 'UNHEALTHY', message: 'Connection refused on port 5672' }),
      true
    );

    const controller = new HealthController(healthService);

    // Liveness remains 200: process is alive
    const livenessResp = await controller.getLiveness(dummyRequest);
    expect(livenessResp.status).toBe(200);

    // Readiness drops to 503: traffic must NOT be routed
    const readinessResp = await controller.getReadiness(dummyRequest);
    expect(readinessResp.status).toBe(503);
    expect((readinessResp.data as any).ready).toBe(false);

    // Health drops to 503: UNHEALTHY
    const healthResp = await controller.getHealth(dummyRequest);
    expect(healthResp.status).toBe(503);
    expect((healthResp.data as any).status).toBe('UNHEALTHY');
  });

  it('maintains readiness but marks DEGRADED when an optional dependency is degraded', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'test');

    healthService.registerComponent(
      'DATABASE',
      async () => ({ status: 'HEALTHY', message: 'DB up' }),
      true
    );
    healthService.registerComponent(
      'ANALYTICS_CACHE',
      async () => ({ status: 'DEGRADED', message: 'Cache miss rate high' }),
      false // Optional
    );

    const controller = new HealthController(healthService);

    const readinessResp = await controller.getReadiness(dummyRequest);
    expect(readinessResp.status).toBe(200);
    expect((readinessResp.data as any).ready).toBe(true);

    const healthResp = await controller.getHealth(dummyRequest);
    expect(healthResp.status).toBe(200);
    expect((healthResp.data as any).status).toBe('DEGRADED');
  });

  it('drops readiness to 503 during SERVER_DRAIN while keeping liveness alive (200)', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'test');

    let isDraining = false;
    healthService.registerComponent(
      'SERVER_DRAIN',
      async () => {
        if (isDraining) {
          return { status: 'UNHEALTHY', message: 'Server is draining active connections' };
        }
        return { status: 'HEALTHY', message: 'Server accepting traffic' };
      },
      true
    );

    const controller = new HealthController(healthService);

    // Initial state: ready
    let readiness = await controller.getReadiness(dummyRequest);
    expect(readiness.status).toBe(200);

    // Enter draining state during graceful shutdown
    isDraining = true;

    // Liveness MUST still be 200 so orchestrator doesn't send SIGKILL
    const liveness = await controller.getLiveness(dummyRequest);
    expect(liveness.status).toBe(200);

    // Readiness MUST drop to 503 so load balancer removes instance from pool
    readiness = await controller.getReadiness(dummyRequest);
    expect(readiness.status).toBe(503);
    expect((readiness.data as any).ready).toBe(false);
  });

  it('sanitizes component health details and excludes sensitive secrets', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'test');

    healthService.registerComponent(
      'STORAGE',
      async () => ({
        status: 'HEALTHY',
        message: 'Storage online',
        details: {
          connectionString: 'postgres://admin:topsecret@db.local:5432/mind',
          apiKey: 'sk-1234567890abcdef1234567890abcdef',
          safeParam: 'active',
        },
      }),
      true
    );

    const report = await healthService.getHealth();
    const storageComp = report.components['STORAGE'];

    expect(storageComp).toBeDefined();
    expect(storageComp?.details?.['safeParam']).toBe('active');
    expect(storageComp?.details?.['apiKey']).toBe('[REDACTED]');
    expect(storageComp?.details?.['connectionString']).toContain('://admin:[REDACTED]@');
  });
});
