import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductionBootstrap } from '../../src/platform/bootstrap/ProductionBootstrap.js';
import { PlatformTokens } from '../../src/platform/di/PlatformTokens.js';
import { PlatformError } from '../../src/platform/errors/PlatformError.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Production Bootstrap & Platform Lifecycle', () => {
  const testDir = path.resolve(process.cwd(), '.projectmind_test_bootstrap');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error on Windows lock
    }
  });

  it('successfully bootstraps ProjectMindPlatform and registers DI dependencies', async () => {
    const platform = await ProductionBootstrap.bootstrap({
      workspacePath: testDir,
      disableSignalHandlers: true,
      configOverrides: {
        app: {
          name: 'test-bootstrap-app',
          env: 'test',
          logLevel: 'INFO',
        },
        storage: {
          type: 'memory',
        },
      },
    });

    expect(platform).toBeDefined();
    expect(platform.config.app.name).toBe('test-bootstrap-app');
    expect(platform.container.resolve(PlatformTokens.IPlatformConfig)).toBe(platform.config);
    expect(platform.container.resolve(PlatformTokens.IProductionLogger)).toBe(platform.logger);
    expect(platform.container.resolve(PlatformTokens.IPlatformHealthService)).toBe(platform.healthService);
    expect(platform.container.resolve(PlatformTokens.IPlatformTelemetry)).toBe(platform.telemetry);
    expect(platform.container.resolve(PlatformTokens.IPlatformLifecycleManager)).toBe(platform.lifecycle);
    expect(platform.container.resolve(PlatformTokens.IProjectMindPlatform)).toBe(platform);

    // Verify liveness and readiness
    const liveness = platform.getLiveness();
    expect(liveness.status).toBe('alive');

    const readiness = await platform.getReadiness();
    expect(readiness.ready).toBe(true);

    const health = await platform.getHealth();
    expect(health.status).toBe('HEALTHY');
    expect(health.components['CONFIG']?.status).toBe('HEALTHY');
    expect(health.components['KERNEL']?.status).toBe('HEALTHY');
    expect(health.components['EVENT_BUS']?.status).toBe('HEALTHY');
    expect(health.components['AGENT_RUNTIME']?.status).toBe('HEALTHY');

    // Start platform and shut down gracefully
    await platform.start();
    expect(platform.lifecycle.getState()).toBe('READY');

    await platform.shutdown('test completion');
    expect(platform.lifecycle.getState()).toBe('STOPPED');
  });

  it('fails fast with structured PlatformError if invalid configuration is passed', async () => {
    await expect(
      ProductionBootstrap.bootstrap({
        workspacePath: testDir,
        disableSignalHandlers: true,
        configOverrides: {
          runtime: {
            maxConcurrentSessions: -99,
          },
        },
      })
    ).rejects.toThrow(PlatformError);
  });
});
