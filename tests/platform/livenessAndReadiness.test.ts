import { describe, it, expect } from 'vitest';
import { PlatformLivenessProvider } from '../../src/platform/health/PlatformLivenessProvider.js';
import { PlatformReadinessProvider } from '../../src/platform/health/PlatformReadinessProvider.js';

describe('Platform Liveness & Readiness Probes', () => {
  it('returns lightweight liveness status without executing database scans', () => {
    const livenessProvider = new PlatformLivenessProvider();
    const liveness = livenessProvider.getLiveness();

    expect(liveness.status).toBe('alive');
    expect(typeof liveness.uptimeMs).toBe('number');
    expect(liveness.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(liveness.timestamp).toBeDefined();
  });

  it('reports ready when all required dependencies are healthy', async () => {
    const readinessProvider = new PlatformReadinessProvider();
    readinessProvider.registerDependency('CONFIG', () => true, true);
    readinessProvider.registerDependency('STORAGE', async () => true, true);
    readinessProvider.registerDependency('CACHE', () => true, false); // optional

    const report = await readinessProvider.getReadiness();
    expect(report.ready).toBe(true);
    expect(report.dependencies['CONFIG']).toBe(true);
    expect(report.dependencies['STORAGE']).toBe(true);
    expect(report.dependencies['CACHE']).toBe(true);
  });

  it('reports NOT ready when a critical required dependency fails', async () => {
    const readinessProvider = new PlatformReadinessProvider();
    readinessProvider.registerDependency('CONFIG', () => true, true);
    readinessProvider.registerDependency('DATABASE', () => false, true); // critical required failure

    const report = await readinessProvider.getReadiness();
    expect(report.ready).toBe(false);
    expect(report.dependencies['DATABASE']).toBe(false);
  });

  it('remains ready when only an optional dependency fails', async () => {
    const readinessProvider = new PlatformReadinessProvider();
    readinessProvider.registerDependency('CONFIG', () => true, true);
    readinessProvider.registerDependency('STORAGE', () => true, true);
    readinessProvider.registerDependency('OPTIONAL_CACHE', () => false, false); // optional failure

    const report = await readinessProvider.getReadiness();
    expect(report.ready).toBe(true);
    expect(report.dependencies['OPTIONAL_CACHE']).toBe(false);
  });
});
