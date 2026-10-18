import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';

export class HealthCommand implements CLICommand {
  public readonly name = 'health';
  public readonly description = 'Checks system health across storage, kernel, event bus, agent runtime, and jobs.';
  public readonly usage = 'projectmind health [--verbose] [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'verbose',
      description: 'Display detailed subsystem health breakdowns and metrics',
      hasValue: false,
    },
    {
      name: 'json',
      description: 'Output health status in JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const kernel = await ctx.getKernel();
    const config = ctx.getConfig();
    const health = await kernel.observabilityEngine.getHealth();
    const workspacePath = kernel.workspaceManager.workspacePath ?? process.cwd();

    // 1. Inspect real SQLite database status
    let storageStatus = 'HEALTHY';
    let storageMessage = 'In-memory or filesystem operational';
    const dbDir = path.resolve(workspacePath, '.projectmind/data');
    const dbPath = path.join(dbDir, 'projectmind.db');

    let pendingJobsCount = 0;
    let deadLetterJobsCount = 0;

    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath, { readonly: true, timeout: 2000 });
        try {
          const check: any = db.pragma('quick_check(1)', { simple: true });
          const journal: any = db.pragma('journal_mode', { simple: true });
          if (check === 'ok') {
            storageStatus = 'HEALTHY';
            storageMessage = `SQLite WAL mode operational (journal_mode: ${journal})`;
          } else {
            storageStatus = 'DEGRADED';
            storageMessage = `SQLite integrity warning: ${check}`;
          }

          try {
            const row: any = db.prepare("SELECT count(*) as count FROM pm_durable_jobs WHERE status = 'PENDING';").get();
            const dlq: any = db.prepare("SELECT count(*) as count FROM pm_durable_jobs WHERE status = 'DEAD_LETTERED';").get();
            pendingJobsCount = row?.count ?? 0;
            deadLetterJobsCount = dlq?.count ?? 0;
          } catch {
            // Queue tables not present yet
          }
        } finally {
          db.close();
        }
      } catch (err: unknown) {
        storageStatus = 'UNHEALTHY';
        storageMessage = `SQLite connection error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    const failedPlugins = kernel.pluginRuntime.getPlugins().filter((p) => p.state === 'failed');

    const components = {
      kernel: { status: 'HEALTHY', message: 'ProjectMindKernel active' },
      workspace: { status: 'HEALTHY', message: kernel.workspaceManager.workspacePath },
      storage: { status: storageStatus, message: storageMessage },
      eventBus: { status: 'HEALTHY', message: 'NodeEventBus active' },
      observability: { status: health.status.toUpperCase(), uptime: health.uptime },
      plugins: {
        status: failedPlugins.length === 0 ? 'HEALTHY' : 'DEGRADED',
        count: kernel.pluginRuntime.getPlugins().length,
        failedCount: failedPlugins.length,
      },
      jobs: {
        status: deadLetterJobsCount > 0 ? 'DEGRADED' : 'HEALTHY',
        pending: pendingJobsCount,
        deadLettered: deadLetterJobsCount,
      },
      security: { status: 'HEALTHY', env: config.app.env },
    };

    const hasFailure = storageStatus === 'UNHEALTHY' || health.status === 'unhealthy';
    const hasDegraded = storageStatus === 'DEGRADED' || deadLetterJobsCount > 0 || failedPlugins.length > 0;

    const overallStatus = hasFailure ? 'UNHEALTHY' : hasDegraded ? 'DEGRADED' : 'HEALTHY';
    const data = {
      status: overallStatus,
      version: config.app.version,
      uptimeSeconds: health.uptime,
      evaluatedAt: new Date().toISOString(),
      components,
    };

    if (overallStatus === 'UNHEALTHY') {
      return createErrorResult(
        this.name,
        CLIExitCode.GENERAL_FAILURE,
        `ProjectMind Health: ${overallStatus} (Uptime: ${health.uptime}s) - Storage or Subsystem failure`,
        [storageMessage],
        [],
        data
      );
    }

    return createSuccessResult(
      this.name,
      data,
      `ProjectMind Health: ${overallStatus} (Uptime: ${health.uptime}s)`
    );
  }
}

