import { describe, it, expect, vi } from 'vitest';
import { DoctorEngine } from '../../src/diagnostics/DoctorEngine.js';
import { DoctorCommand } from '../../src/cli/commands/DoctorCommand.js';
import { HealthCommand } from '../../src/cli/commands/HealthCommand.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';

describe('CLI Diagnostic & Health Commands Suite', () => {
  const createMockKernel = () => {
    return {
      workspaceManager: {
        workspacePath: process.cwd(),
      },
      observabilityEngine: {
        getHealth: vi.fn().mockResolvedValue({
          status: 'healthy',
          uptime: 42,
        }),
      },
      pluginRuntime: {
        getPlugins: vi.fn().mockReturnValue([]),
      },
      snapshotManager: {
        listSnapshots: vi.fn().mockResolvedValue([]),
      },
    } as any;
  };

  const createMockContext = (kernel: any) => {
    return {
      getKernel: vi.fn().mockResolvedValue(kernel),
      getConfig: vi.fn().mockReturnValue({
        app: {
          version: '1.0.0',
          env: 'test',
        },
      }),
      options: {},
    } as any;
  };

  it('runs DoctorEngine diagnostics and validates database, migrations, and memory', async () => {
    const kernel = createMockKernel();
    const doctor = new DoctorEngine(kernel);

    const results = await doctor.runDiagnostics();
    expect(results.length).toBeGreaterThanOrEqual(6);

    const dbCheck = results.find((r) => r.category === 'Database' && r.name.includes('SQLite'));
    expect(dbCheck).toBeDefined();
    expect(dbCheck?.passed).toBe(true);

    const memCheck = results.find((r) => r.category === 'Environment' && r.name.includes('Memory'));
    expect(memCheck).toBeDefined();
    expect(memCheck?.passed).toBe(true);
    expect(memCheck?.message).toMatch(/Node v\d+/);
  });

  it('executes DoctorCommand and returns exit code 0 when all diagnostics pass', async () => {
    const kernel = createMockKernel();
    const ctx = createMockContext(kernel);
    const cmd = new DoctorCommand();

    const result = await cmd.execute(ctx);
    expect(result.exitCode).toBe(CLIExitCode.SUCCESS);
    expect(result.data.overall).toBe('PASS');
    expect(result.data.failed).toBe(0);
    expect(result.data.passed).toBeGreaterThan(0);
  });

  it('returns failure exit code when a critical diagnostic fails', async () => {
    const kernel = createMockKernel();
    // Simulate invalid workspace
    kernel.workspaceManager.workspacePath = '';
    const ctx = createMockContext(kernel);
    const cmd = new DoctorCommand();

    const result = await cmd.execute(ctx);
    expect(result.exitCode).toBe(CLIExitCode.GENERAL_FAILURE);
    const summary = (result.metadata ?? result.data) as any;
    expect(summary?.overall).toBe('FAIL');
    expect(summary?.failed).toBeGreaterThanOrEqual(1);
    expect(result.errors?.length).toBeGreaterThanOrEqual(1);
  });

  it('executes HealthCommand and inspects truthful storage and jobs status', async () => {
    const kernel = createMockKernel();
    const ctx = createMockContext(kernel);
    const cmd = new HealthCommand();

    const result = await cmd.execute(ctx);
    expect(result.exitCode).toBe(CLIExitCode.SUCCESS);
    const data = result.data as Record<string, any>;
    expect(data.status).toBe('HEALTHY');
    expect(data.components.kernel.status).toBe('HEALTHY');
    expect(data.components.observability.status).toBe('HEALTHY');
    expect(data.components.jobs.status).toBe('HEALTHY');
  });
});
