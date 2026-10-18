import * as path from 'path';
import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult } from '../core/CLIResult.js';

export class StatusCommand implements CLICommand {
  public readonly name = 'status';
  public readonly description = 'Displays current project state, knowledge version, health, and agent runtime status.';
  public readonly usage = 'projectmind status [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'json',
      description: 'Output status in JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const kernel = await ctx.getKernel();
    const config = ctx.getConfig();
    const health = await kernel.observabilityEngine.getHealth();

    const workspacePath = kernel.workspaceManager.workspacePath ?? ctx.workspacePath;
    const repoName = path.basename(workspacePath);
    const snapshots = kernel.snapshotManager.listSnapshots();

    const statusData = {
      project: repoName,
      workspace: workspacePath,
      repository: repoName,
      status: 'ACTIVE',
      environment: config.app.env,
      version: config.app.version,
      health: health.status.toUpperCase(),
      uptimeSeconds: health.uptime,
      knowledgeVersion: snapshots.length > 0 ? `v${snapshots.length}` : 'v1.0.0',
      snapshotsCount: snapshots.length,
      pendingUpdates: 0,
      activePlugins: kernel.pluginRuntime.getPlugins().length,
      lastUpdated: new Date().toISOString(),
    };

    return createSuccessResult(
      this.name,
      statusData,
      `ProjectMind status for '${repoName}': ${statusData.health}`
    );
  }
}
