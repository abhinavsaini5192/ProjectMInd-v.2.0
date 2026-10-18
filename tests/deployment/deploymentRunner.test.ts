import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeploymentRunner } from '../../src/platform/runner/DeploymentRunner.js';

describe('Phase 10.5 Deployment - Deployment Runner Runtime Roles', () => {
  const testDir = path.resolve(process.cwd(), '.projectmind_test_runner');

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
      // Ignore
    }
  });

  it('runs migration role as a standalone one-shot execution', async () => {
    const result = await DeploymentRunner.run({
      role: 'migration',
      workspacePath: testDir,
      disableSignalHandlers: true,
      configOverrides: {
        app: { env: 'test', logLevel: 'ERROR' },
        storage: { type: 'sqlite', location: '.projectmind/data' },
        database: { autoMigrate: false },
      },
    });

    expect(result.role).toBe('migration');
    expect(result.migrationResult).toBeDefined();
    expect(result.migrationResult!.success).toBe(true);
    expect(result.migrationResult!.currentVersion).toBe(3);
  });

  it('boots api role, starts HTTP server, and performs coordinated graceful shutdown', async () => {
    const result = await DeploymentRunner.run({
      role: 'api',
      workspacePath: testDir,
      disableSignalHandlers: true,
      configOverrides: {
        app: { env: 'test', logLevel: 'ERROR' },
        storage: { type: 'memory' },
        server: { port: 0, host: '127.0.0.1', drainTimeoutMs: 1000 },
        database: { autoMigrate: false },
      },
    });

    expect(result.role).toBe('api');
    expect(result.platform).toBeDefined();
    expect(result.server).toBeDefined();
    expect(result.server!.isRunning()).toBe(true);

    // Stop and verify clean state
    await result.stop();
    expect(result.server!.isRunning()).toBe(false);
  });

  it('boots worker role, starts background processing, and performs graceful shutdown', async () => {
    const result = await DeploymentRunner.run({
      role: 'worker',
      workspacePath: testDir,
      disableSignalHandlers: true,
      configOverrides: {
        app: { env: 'test', logLevel: 'ERROR' },
        storage: { type: 'sqlite', location: '.projectmind/data' },
        worker: { concurrency: 2, pollIntervalMs: 100, visibilityTimeoutMs: 5000 },
        server: { port: 0, host: '127.0.0.1' },
        database: { autoMigrate: true },
      },
    });

    expect(result.role).toBe('worker');
    expect(result.platform).toBeDefined();

    // Stop and verify clean shutdown
    await result.stop();
    expect(result.platform!.lifecycle.getState()).toBe('STOPPED');
  });
});
