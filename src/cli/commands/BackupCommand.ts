import path from 'node:path';
import fs from 'node:fs';
import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import {
  SqliteDatabaseBackupManager,
  SqliteDatabaseRestoreManager,
  IntelligenceRebuildManager,
} from '../../storage/recovery/index.js';

export class BackupCommand implements CLICommand {
  public readonly name = 'backup';
  public readonly description =
    'Manage database backups, integrity verification, safe restoration, and derived intelligence recovery.';
  public readonly usage =
    'projectmind backup <create|list|verify|restore|staleness|prune-cache> [options]';

  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'description',
      description: 'Human-readable description for created backup',
      hasValue: true,
    },
    {
      name: 'retention-count',
      description: 'Maximum number of historical backups to retain (preserves at least 1 verified copy)',
      hasValue: true,
    },
    {
      name: 'retention-days',
      description: 'Maximum age of backups in days',
      hasValue: true,
    },
    {
      name: 'target',
      description: 'Target database path for restoration',
      hasValue: true,
    },
    {
      name: 'authorized-by',
      description: 'Operator or service principal authorizing a restore operation',
      hasValue: true,
    },
    {
      name: 'confirm-production-overwrite',
      description: 'Explicit confirmation required to restore directly over the active production database',
      hasValue: false,
    },
    {
      name: 'json',
      description: 'Output results in JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const subcommand = ctx.args[0] ?? 'list';
    const workspacePath = ctx.workspacePath ?? process.cwd();
    const config = ctx.getConfig();

    // Default paths
    const dbDir = path.resolve(workspacePath, '.projectmind/data');
    const defaultDbPath = path.join(dbDir, 'projectmind.db');
    const backupDir = path.join(dbDir, 'backups');

    const backupManager = new SqliteDatabaseBackupManager({
      databasePath: defaultDbPath,
      backupDirectory: backupDir,
      applicationVersion: config.app.version,
    });

    const restoreManager = new SqliteDatabaseRestoreManager({
      backupDirectory: backupDir,
      defaultActiveDatabasePath: defaultDbPath,
      currentApplicationVersion: config.app.version,
    });

    const rebuildManager = new IntelligenceRebuildManager();

    switch (subcommand) {
      case 'create': {
        if (!fs.existsSync(defaultDbPath)) {
          return createErrorResult(
            this.name,
            CLIExitCode.GENERAL_FAILURE,
            `Cannot create backup: database file not found at '${defaultDbPath}'`,
            ['Database must be initialized prior to backup.']
          );
        }

        const description = ctx.getOption<string>('description');
        const retentionCountStr = ctx.getOption<string>('retention-count');
        const retentionDaysStr = ctx.getOption<string>('retention-days');

        const retention =
          retentionCountStr || retentionDaysStr
            ? {
                maxBackupsToRetain: retentionCountStr ? parseInt(retentionCountStr, 10) : undefined,
                maxAgeDays: retentionDaysStr ? parseInt(retentionDaysStr, 10) : undefined,
              }
            : undefined;

        try {
          const record = await backupManager.createBackup({
            description,
            retention,
          });

          return createSuccessResult(
            this.name,
            record,
            `Backup created successfully: ${record.backupId} (${record.sizeBytes} bytes, ${record.durationMs}ms)`
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return createErrorResult(
            this.name,
            CLIExitCode.GENERAL_FAILURE,
            `Backup creation failed: ${msg}`,
            [msg]
          );
        }
      }

      case 'list': {
        const backups = await backupManager.listBackups();
        const data = {
          count: backups.length,
          backupDirectory: backupDir,
          backups,
        };

        const msg =
          backups.length === 0
            ? `No backups found in '${backupDir}'.`
            : `Found ${backups.length} backup(s) in '${backupDir}'.`;

        return createSuccessResult(this.name, data, msg);
      }

      case 'verify': {
        const backupId = ctx.args[1];
        if (!backupId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing required argument: <backupId>. Usage: projectmind backup verify <backupId>',
            ['Provide a valid backup identifier.']
          );
        }

        const result = await backupManager.verifyBackup(backupId);
        if (!result.isValid) {
          return createErrorResult(
            this.name,
            CLIExitCode.GENERAL_FAILURE,
            `Backup '${backupId}' failed verification:\n- ${result.errors.join('\n- ')}`,
            [...result.errors],
            [],
            result as unknown as Record<string, unknown>
          );
        }

        return createSuccessResult(
          this.name,
          result,
          `Backup '${backupId}' verified successfully (SHA-256 and SQLite integrity intact).`
        );
      }

      case 'restore': {
        const backupId = ctx.args[1];
        if (!backupId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing required argument: <backupId>. Usage: projectmind backup restore <backupId> --target <path> --authorized-by <user>',
            ['Provide a valid backup identifier.']
          );
        }

        const targetPath = ctx.getOption<string>('target');
        if (!targetPath) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing required option: --target <path>. Explicit target identification is required to prevent accidental overwrites.',
            ['Specify --target <path>']
          );
        }

        const authorizedBy = ctx.getOption<string>('authorized-by');
        if (!authorizedBy) {
          return createErrorResult(
            this.name,
            CLIExitCode.AUTH_FAILURE,
            'Restore operations require operational authorization. Please specify --authorized-by <username_or_role>',
            ['Specify --authorized-by <user>']
          );
        }

        const confirmOverwrite = Boolean(ctx.getOption('confirm-production-overwrite'));

        try {
          const report = await restoreManager.executeRestore({
            backupId,
            targetDatabasePath: targetPath,
            authorizedBy,
            confirmProductionOverwrite: confirmOverwrite,
            activeDatabasePath: defaultDbPath,
          });

          return createSuccessResult(
            this.name,
            report,
            `Restore completed successfully from '${backupId}' to '${targetPath}' (${report.durationMs}ms, ${report.tablesFound.length} tables verified)`
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return createErrorResult(
            this.name,
            CLIExitCode.GENERAL_FAILURE,
            `Restore failed: ${msg}`,
            [msg]
          );
        }
      }

      case 'staleness': {
        if (!fs.existsSync(defaultDbPath)) {
          return createErrorResult(
            this.name,
            CLIExitCode.GENERAL_FAILURE,
            `Database file not found at '${defaultDbPath}'`,
            ['Database must exist to analyze index staleness.']
          );
        }

        try {
          const report = await rebuildManager.detectStaleness(defaultDbPath, workspacePath);
          return createSuccessResult(
            this.name,
            report,
            report.isStale
              ? `Derived intelligence index is STALE (${report.staleFilesCount} changed files, ${report.missingFilesCount} missing files)`
              : `Derived intelligence index is UP TO DATE (${report.totalIndexedFiles} files, ${report.totalSymbols} symbols)`
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return createErrorResult(
            this.name,
            CLIExitCode.GENERAL_FAILURE,
            `Staleness check failed: ${msg}`,
            [msg]
          );
        }
      }

      case 'prune-cache': {
        if (!fs.existsSync(defaultDbPath)) {
          return createSuccessResult(this.name, { cleared: 0 }, 'No database found; 0 cache entries pruned.');
        }

        try {
          const cleared = await rebuildManager.clearEphemeralCaches(defaultDbPath);
          return createSuccessResult(
            this.name,
            { cleared },
            `Successfully pruned ${cleared} ephemeral cache entries without touching authoritative data.`
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return createErrorResult(
            this.name,
            CLIExitCode.GENERAL_FAILURE,
            `Failed to prune cache: ${msg}`,
            [msg]
          );
        }
      }

      default:
        return createErrorResult(
          this.name,
          CLIExitCode.INVALID_USAGE,
          `Unknown subcommand '${subcommand}'. Valid subcommands: create, list, verify, restore, staleness, prune-cache`,
          ['Run projectmind backup --help for usage details.']
        );
    }
  }
}
