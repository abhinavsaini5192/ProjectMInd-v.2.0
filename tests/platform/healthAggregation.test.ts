import { describe, it, expect } from 'vitest';
import { PlatformHealthService } from '../../src/platform/health/PlatformHealthService.js';

describe('Platform Health Aggregation', () => {
  it('aggregates to HEALTHY when all registered components pass', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'production');
    healthService.registerComponent('STORAGE', async () => ({ status: 'HEALTHY' }), true);
    healthService.registerComponent('EVENT_BUS', async () => ({ status: 'HEALTHY' }), true);

    const report = await healthService.getHealth();
    expect(report.status).toBe('HEALTHY');
    expect(report.failures.length).toBe(0);
    expect(report.warnings.length).toBe(0);
  });

  it('aggregates to DEGRADED when an optional component is UNHEALTHY', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'production');
    healthService.registerComponent('STORAGE', async () => ({ status: 'HEALTHY' }), true);
    healthService.registerComponent('REDIS_CACHE', async () => ({ status: 'UNHEALTHY', message: 'Connection timed out' }), false);

    const report = await healthService.getHealth();
    expect(report.status).toBe('DEGRADED');
    expect(report.failures.length).toBe(0);
    expect(report.warnings.length).toBe(1);
    expect(report.warnings[0]).toContain("Optional component 'REDIS_CACHE' is UNHEALTHY");
  });

  it('aggregates to UNHEALTHY when a required component is UNHEALTHY', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'production');
    healthService.registerComponent('STORAGE', async () => ({ status: 'UNHEALTHY', message: 'Disk read-only' }), true);
    healthService.registerComponent('EVENT_BUS', async () => ({ status: 'HEALTHY' }), true);

    const report = await healthService.getHealth();
    expect(report.status).toBe('UNHEALTHY');
    expect(report.failures.length).toBe(1);
    expect(report.failures[0]).toContain("Critical component 'STORAGE' is UNHEALTHY");
  });

  it('sanitizes secrets in component details before exposing report', async () => {
    const healthService = new PlatformHealthService('1.0.0', 'production');
    healthService.registerComponent('DATABASE', async () => ({
      status: 'HEALTHY',
      details: {
        connectionString: 'postgres://user:superSecretPass@localhost:5432/pmdb',
        authToken: 'jwt-12345',
        poolSize: 10,
      },
    }), true);

    const report = await healthService.getHealth();
    const dbDetails = report.components['DATABASE']?.details as any;
    expect(dbDetails).toBeDefined();
    expect(dbDetails.connectionString).toContain('[REDACTED]');
    expect(dbDetails.connectionString).not.toContain('superSecretPass');
    expect(dbDetails.authToken).toBe('[REDACTED]');
    expect(dbDetails.poolSize).toBe(10);
  });
});
