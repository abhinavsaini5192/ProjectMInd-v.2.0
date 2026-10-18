import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult } from '../core/CLIResult.js';
import { CanonicalReleaseMetadata } from '../../production/models/ReleaseMetadata.js';

export class VersionCommand implements CLICommand {
  public readonly name = 'version';
  public readonly description = 'Displays the ProjectMind version, build ID, and compatibility metadata.';
  public readonly usage = 'projectmind version [--json]';
  public readonly aliases = ['-v', '--version'];
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'json',
      description: 'Output version information in machine-readable JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const versionData = {
      version: CanonicalReleaseMetadata.version,
      buildId: CanonicalReleaseMetadata.buildId,
      gitCommit: CanonicalReleaseMetadata.gitCommit,
      gitBranch: CanonicalReleaseMetadata.gitBranch,
      schemaVersion: CanonicalReleaseMetadata.schemaVersion,
      apiVersion: CanonicalReleaseMetadata.apiVersion,
      runtimeVersion: CanonicalReleaseMetadata.runtimeVersion,
      nodeVersion: process.version,
    };

    return createSuccessResult(
      this.name,
      versionData,
      `ProjectMind v${versionData.version} (${versionData.buildId})`
    );
  }
}
