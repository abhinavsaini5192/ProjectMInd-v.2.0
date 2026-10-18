import { describe, it, expect, beforeEach } from 'vitest';
import { HealthManager } from '../../src/observability/index.js';

describe('Observability - Health & Dependency Monitoring', () => {
  let healthManager: HealthManager;

  beforeEach(() => {
    healthManager = new HealthManager({ defaultTimeoutMs: 500 });
  });

  it('reports liveness with process uptime', () => {
    const liveness = healthManager.getLiveness();
    expect(liveness.status).toBe('alive');
    expect(liveness.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(liveness.timestamp).toBeDefined();
  });

  it('evaluates overall health as HEALTHY when all components pass', async () => {
    healthManager.registerCheck({
      name: 'database',
      category: 'DEPENDENCY',
      required: true,
      check: async () => ({ status: 'HEALTHY' }),
    });

    healthManager.registerCheck({
      name: 'cache',
      category: 'DEPENDENCY',
      required: false,
      check: async () => ({ status: 'HEALTHY' }),
    });

    const report = await healthManager.getHealth();
    expect(report.status).toBe('HEALTHY');
    expect(report.readiness.ready).toBe(true);
    expect(report.readiness.criticalDependenciesHealthy).toBe(true);
    expect(report.failures).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);

    const readiness = await healthManager.getReadiness();
    expect(readiness.ready).toBe(true);
    expect(readiness.dependencies['database']).toBe(true);
    expect(readiness.dependencies['cache']).toBe(true);
  });

  it('marks system DEGRADED when optional dependency fails, keeping readiness TRUE', async () => {
    healthManager.registerCheck({
      name: 'core_database',
      category: 'DEPENDENCY',
      required: true,
      check: async () => ({ status: 'HEALTHY' }),
    });

    healthManager.registerCheck({
      name: 'external_telemetry_exporter',
      category: 'DEPENDENCY',
      required: false,
      check: async () => ({
        status: 'UNHEALTHY',
        message: 'Endpoint unreachable',
      }),
    });

    const report = await healthManager.getHealth();
    expect(report.status).toBe('DEGRADED');
    // Service is still ready to accept domain work!
    expect(report.readiness.ready).toBe(true);
    expect(report.readiness.criticalDependenciesHealthy).toBe(true);
    expect(report.failures).toHaveLength(0);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain("Optional component 'external_telemetry_exporter' is UNHEALTHY");

    const readiness = await healthManager.getReadiness();
    expect(readiness.ready).toBe(true);
    expect(readiness.dependencies['external_telemetry_exporter']).toBe(false);
  });

  it('marks system UNHEALTHY and readiness FALSE when a required dependency fails', async () => {
    healthManager.registerCheck({
      name: 'sqlite_primary',
      category: 'DEPENDENCY',
      required: true,
      check: async () => ({
        status: 'UNHEALTHY',
        message: 'Database disk I/O error',
      }),
    });

    const report = await healthManager.getHealth();
    expect(report.status).toBe('UNHEALTHY');
    expect(report.readiness.ready).toBe(false);
    expect(report.readiness.criticalDependenciesHealthy).toBe(false);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toContain("Critical component 'sqlite_primary' is UNHEALTHY");

    const readiness = await healthManager.getReadiness();
    expect(readiness.ready).toBe(false);
  });

  it('handles uncaught exceptions in health checks safely without crashing', async () => {
    healthManager.registerCheck({
      name: 'crashing_check',
      category: 'DEPENDENCY',
      required: true,
      check: async () => {
        throw new Error('Fatal socket closed');
      },
    });

    const report = await healthManager.getHealth();
    expect(report.status).toBe('UNHEALTHY');
    expect(report.components['crashing_check']?.message).toContain('Fatal socket closed');
  });
});
