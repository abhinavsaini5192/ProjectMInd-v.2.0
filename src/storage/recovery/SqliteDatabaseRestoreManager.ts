import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';
import type { RecoveryTelemetry } from '../../observability/instrumentation/RecoveryTelemetry.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import type { DatabaseBackupRecord } from './SqliteDatabaseBackupManager.js';

export interface SqliteRestoreOptions {
  readonly backupId: string;
  readonly targetDatabasePath: string;
  readonly authorizedBy: string;
  readonly confirmProductionOverwrite?: boolean | undefined;
  readonly activeDatabasePath?: string | undefined;
  readonly applicationVersion?: string | undefined;
}

export interface SqliteRestoreValidationResult {
  readonly canRestore: boolean;
  readonly backupId: string;
  readonly isProductionTarget: boolean;
  readonly metadata?: DatabaseBackupRecord | undefined;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface SqliteRestoreReport {
  readonly restoreId: string;
  readonly backupId: string;
  readonly targetDatabasePath: string;
  readonly isProductionOverwrite: boolean;
  readonly preRestoreSafetyCopyPath?: string | undefined;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly schemaVersion: number;
  readonly backupApplicationVersion: string;
  readonly currentApplicationVersion: string;
  readonly integrityCheckResult: string;
  readonly foreignKeysValid: boolean;
  readonly tablesFound: readonly string[];
  readonly recordCounts: Record<string, number>;
  readonly message: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface SqliteDatabaseRestoreManagerOptions {
  readonly backupDirectory?: string | undefined;
  readonly defaultActiveDatabasePath?: string | undefined;
  readonly currentApplicationVersion?: string | undefined;
  readonly logger?: ILogger | undefined;
  readonly telemetry?: RecoveryTelemetry | undefined;
}

export class SqliteDatabaseRestoreManager {
  private readonly backupDirectory: string;
  private readonly defaultActiveDatabasePath?: string | undefined;
  private readonly currentApplicationVersion: string;
  private readonly logger?: ILogger | undefined;
  private readonly telemetry?: RecoveryTelemetry | undefined;
  private isRestoreInProgress = false;

  constructor(options: SqliteDatabaseRestoreManagerOptions = {}) {
    this.backupDirectory = path.resolve(
      options.backupDirectory ??
        (options.defaultActiveDatabasePath
          ? path.join(path.dirname(options.defaultActiveDatabasePath), 'backups')
          : './backups')
    );
    this.defaultActiveDatabasePath = options.defaultActiveDatabasePath
      ? path.resolve(options.defaultActiveDatabasePath)
      : undefined;
    this.currentApplicationVersion = options.currentApplicationVersion ?? '1.0.0';
    this.logger = options.logger;
    this.telemetry = options.telemetry;
  }

  public getBackupDirectory(): string {
    return this.backupDirectory;
  }

  /**
   * Validates all pre-conditions before executing a restore operation:
   * 1. Operational authorization (authorizedBy)
   * 2. Backup metadata and backup file existence
   * 3. SHA-256 cryptographic checksum verification
   * 4. SQLite quick_check integrity probe
   * 5. Target environment protection guard (rejecting accidental production overwrite)
   * 6. Application version and migration compatibility checks
   */
  public async validateRestore(options: SqliteRestoreOptions): Promise<SqliteRestoreValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Operational authorization guard
    if (!options.authorizedBy || options.authorizedBy.trim().length === 0) {
      errors.push('Restore requires explicit operational authorization (authorizedBy)');
    }

    // 2. Identify active database path
    const activePath = path.resolve(
      options.activeDatabasePath ?? this.defaultActiveDatabasePath ?? './projectmind.db'
    );
    const targetPath = path.resolve(options.targetDatabasePath);
    const isProductionTarget = activePath.toLowerCase() === targetPath.toLowerCase();

    // 3. Safety guard against accidental production database overwrite
    if (isProductionTarget && !options.confirmProductionOverwrite) {
      errors.push(
        `Target path '${targetPath}' is the active production database. Destructive production restore is blocked unless confirmProductionOverwrite is explicitly set to true.`
      );
    }

    // 4. Verify backup metadata existence
    const metadataPath = path.join(this.backupDirectory, `${options.backupId}.json`);
    if (!fs.existsSync(metadataPath)) {
      errors.push(`Backup metadata file not found for '${options.backupId}' at '${metadataPath}'`);
      return {
        canRestore: false,
        backupId: options.backupId,
        isProductionTarget,
        errors,
        warnings,
      };
    }

    let metadata: DatabaseBackupRecord;
    try {
      const raw = fs.readFileSync(metadataPath, 'utf8');
      metadata = JSON.parse(raw) as DatabaseBackupRecord;
    } catch (parseErr: any) {
      errors.push(`Failed to parse backup metadata for '${options.backupId}': ${parseErr.message}`);
      return {
        canRestore: false,
        backupId: options.backupId,
        isProductionTarget,
        errors,
        warnings,
      };
    }

    // 5. Verify backup database file existence
    const backupFile = metadata.backupPath ?? path.join(this.backupDirectory, `${options.backupId}.db`);
    if (!fs.existsSync(backupFile)) {
      errors.push(`Backup database file not found at '${backupFile}'`);
      return {
        canRestore: false,
        backupId: options.backupId,
        isProductionTarget,
        metadata,
        errors,
        warnings,
      };
    }

    // 6. Cryptographic SHA-256 verification
    try {
      const content = fs.readFileSync(backupFile);
      const computedHash = crypto.createHash('sha256').update(content).digest('hex');
      if (computedHash !== metadata.sha256Checksum) {
        errors.push(
          `Cryptographic checksum mismatch for backup '${options.backupId}': expected ${metadata.sha256Checksum}, computed ${computedHash}`
        );
      }
    } catch (readErr: any) {
      errors.push(`Failed to read backup file for checksum verification: ${readErr.message}`);
    }

    // 7. SQLite internal probe check
    try {
      const probeDb = new Database(backupFile, { readonly: true, timeout: 5000 });
      try {
        const check: any = probeDb.pragma('quick_check(1)', { simple: true });
        if (check !== 'ok') {
          errors.push(`SQLite quick_check on backup failed: ${check}`);
        }
      } finally {
        probeDb.close();
      }
    } catch (dbErr: any) {
      errors.push(`Failed to probe backup database file: ${dbErr.message}`);
    }

    // 8. Application version compatibility check
    const currentAppVer = options.applicationVersion ?? this.currentApplicationVersion;
    if (metadata.applicationVersion && metadata.applicationVersion !== currentAppVer) {
      warnings.push(
        `Backup was created with application version '${metadata.applicationVersion}', restoring into version '${currentAppVer}'`
      );
    }

    return {
      canRestore: errors.length === 0,
      backupId: options.backupId,
      isProductionTarget,
      metadata,
      errors,
      warnings,
    };
  }

  /**
   * Executes a safe, audited, non-destructive (by default) database restore:
   * - Enforces pre-restore validation and authorization
   * - Preserves a safety copy if the target database already exists
   * - Cleans up dangling -wal and -shm files at target to prevent replay of stale frames
   * - Atomically copies verified backup file to destination
   * - Performs post-restore integrity check, foreign key check, and table enumeration
   * - Emits structured audit logging and metrics
   */
  public async executeRestore(options: SqliteRestoreOptions): Promise<SqliteRestoreReport> {
    if (this.isRestoreInProgress) {
      throw new StorageCoreError('Another restore operation is currently in progress.');
    }

    this.isRestoreInProgress = true;
    const startTime = Date.now();
    const restoreId = `rst_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const targetPath = path.resolve(options.targetDatabasePath);

    try {
      // 1. Pre-restore validation
      const validation = await this.validateRestore(options);
      if (!validation.canRestore) {
        const errorMsg = `Restore validation failed:\n- ${validation.errors.join('\n- ')}`;
        this.telemetry?.recordRestoreFailure(options.backupId, errorMsg, Date.now() - startTime);
        throw new StorageCoreError(errorMsg);
      }

      const metadata = validation.metadata!;
      const backupFile = metadata.backupPath ?? path.join(this.backupDirectory, `${options.backupId}.db`);
      const warnings: string[] = [...validation.warnings];

      this.logger?.warn?.({
        component: 'SqliteDatabaseRestoreManager',
        operation: 'executeRestore',
        message: `Beginning database restore '${restoreId}' from backup '${options.backupId}' into target '${targetPath}', authorized by '${options.authorizedBy}'`,
        details: {
          restoreId,
          backupId: options.backupId,
          targetPath,
          authorizedBy: options.authorizedBy,
          isProductionTarget: validation.isProductionTarget,
        },
      });

      // 2. Target safety guard: Create safety copy if target database already exists
      let preRestoreSafetyCopyPath: string | undefined;
      if (fs.existsSync(targetPath)) {
        const targetDir = path.dirname(targetPath);
        preRestoreSafetyCopyPath = path.join(
          targetDir,
          `${path.basename(targetPath)}.pre_restore_safety_${Date.now()}.db`
        );
        fs.copyFileSync(targetPath, preRestoreSafetyCopyPath);
        this.logger?.info?.({
          component: 'SqliteDatabaseRestoreManager',
          operation: 'executeRestore',
          message: `Created pre-restore safety copy of existing target database at '${preRestoreSafetyCopyPath}'`,
        });
      }

      // 3. Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 4. Stale WAL & SHM cleanup at target to prevent corrupting restored pages
      const targetWal = `${targetPath}-wal`;
      const targetShm = `${targetPath}-shm`;
      if (fs.existsSync(targetWal)) {
        try {
          fs.unlinkSync(targetWal);
        } catch {
          // Ignored
        }
      }
      if (fs.existsSync(targetShm)) {
        try {
          fs.unlinkSync(targetShm);
        } catch {
          // Ignored
        }
      }

      // 5. Atomic restore: copy to temporary file then rename
      const tempRestorePath = `${targetPath}.restore_tmp_${Date.now()}`;
      fs.copyFileSync(backupFile, tempRestorePath);
      fs.renameSync(tempRestorePath, targetPath);

      // 6. Post-restore verification: open target database and perform checks
      let integrityResult = 'unknown';
      let foreignKeyPassed = false;
      let schemaVersion = metadata.schemaVersion;
      const tablesFound: string[] = [];
      const recordCounts: Record<string, number> = {};

      const restoredDb = new Database(targetPath, { readonly: false, timeout: 10000 });
      try {
        // Run full integrity check
        const integrityCheck: any = restoredDb.pragma('integrity_check', { simple: true });
        integrityResult = String(integrityCheck);

        // Run foreign key check
        const fkRows: any = restoredDb.pragma('foreign_key_check');
        foreignKeyPassed = Array.isArray(fkRows) && fkRows.length === 0;

        // Verify or inspect schema migration version
        try {
          const migrationRow: any = restoredDb
            .prepare('SELECT max(version) as ver FROM pm_schema_migrations WHERE status = ?')
            .get('APPLIED');
          if (migrationRow?.ver) {
            schemaVersion = Number(migrationRow.ver);
          }
        } catch {
          // pm_schema_migrations might not exist in early tests
        }

        // Enumerate tables
        const tableRows: any = restoredDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
          .all();
        for (const row of tableRows) {
          tablesFound.push(row.name);
          try {
            const countRow: any = restoredDb.prepare(`SELECT count(*) as cnt FROM "${row.name}"`).get();
            recordCounts[row.name] = Number(countRow?.cnt ?? 0);
          } catch {
            recordCounts[row.name] = -1;
          }
        }

        // Clean WAL checkpoint to ensure all restored transactions are committed into main db
        try {
          restoredDb.pragma('wal_checkpoint(TRUNCATE);');
        } catch {
          // Ignored
        }
      } finally {
        restoredDb.close();
      }

      const completedAt = Date.now();
      const durationMs = completedAt - startTime;

      if (integrityResult !== 'ok') {
        const errorMsg = `Post-restore integrity check failed: ${integrityResult}`;
        this.telemetry?.recordRestoreFailure(options.backupId, errorMsg, durationMs);
        throw new StorageCoreError(errorMsg);
      }

      const report: SqliteRestoreReport = {
        restoreId,
        backupId: options.backupId,
        targetDatabasePath: targetPath,
        isProductionOverwrite: validation.isProductionTarget,
        preRestoreSafetyCopyPath,
        startedAt: startTime,
        completedAt,
        durationMs,
        success: true,
        schemaVersion,
        backupApplicationVersion: metadata.applicationVersion,
        currentApplicationVersion: options.applicationVersion ?? this.currentApplicationVersion,
        integrityCheckResult: integrityResult,
        foreignKeysValid: foreignKeyPassed,
        tablesFound,
        recordCounts,
        message: `Database successfully restored from backup '${options.backupId}' into '${targetPath}'.`,
        warnings,
        errors: [],
      };

      // 7. Telemetry & Audit
      this.telemetry?.recordRestoreSuccess(
        options.backupId,
        durationMs,
        tablesFound.length,
        validation.isProductionTarget ? 'production' : 'isolated'
      );

      this.logger?.info?.({
        component: 'SqliteDatabaseRestoreManager',
        operation: 'executeRestore',
        message: `Restore '${restoreId}' completed successfully in ${durationMs}ms (${tablesFound.length} tables verified, integrity: ${integrityResult})`,
        details: {
          restoreId,
          backupId: options.backupId,
          targetPath,
          schemaVersion,
          tablesCount: tablesFound.length,
        },
      });

      return report;
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.logger?.error?.({
        component: 'SqliteDatabaseRestoreManager',
        operation: 'executeRestore',
        message: `Restore '${restoreId}' failed: ${errorMsg}`,
      });

      throw err;
    } finally {
      this.isRestoreInProgress = false;
    }
  }
}
