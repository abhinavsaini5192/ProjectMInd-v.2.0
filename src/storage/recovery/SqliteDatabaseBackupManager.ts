import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';
import type { RecoveryTelemetry } from '../../observability/instrumentation/RecoveryTelemetry.js';
import { StorageCoreError } from '../types/StorageErrors.js';

export type DatabaseBackupStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CORRUPTED';

export interface DatabaseBackupScope {
  readonly isFull: boolean;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
}

export interface DatabaseBackupRecord {
  readonly backupId: string;
  readonly timestamp: number;
  readonly isoTimestamp: string;
  readonly status: DatabaseBackupStatus;
  readonly databasePath: string;
  readonly backupPath: string;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly schemaVersion: number;
  readonly applicationVersion: string;
  readonly durationMs: number;
  readonly scope: DatabaseBackupScope;
  readonly description?: string | undefined;
  readonly verifiedAt?: number | undefined;
  readonly integrityCheckResult?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface BackupRetentionPolicy {
  readonly maxBackupsToRetain?: number | undefined;
  readonly maxAgeDays?: number | undefined;
}

export interface RetentionCleanupResult {
  readonly retainedCount: number;
  readonly deletedCount: number;
  readonly deletedBackupIds: readonly string[];
}

export interface BackupVerificationResult {
  readonly isValid: boolean;
  readonly backupId: string;
  readonly checkedAt: number;
  readonly schemaVersion?: number | undefined;
  readonly sizeBytes?: number | undefined;
  readonly errors: readonly string[];
}

export interface CreateDatabaseBackupOptions {
  readonly scope?: DatabaseBackupScope | undefined;
  readonly description?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly retention?: BackupRetentionPolicy | undefined;
}

export interface SqliteDatabaseBackupManagerOptions {
  readonly databasePath: string;
  readonly backupDirectory?: string | undefined;
  readonly applicationVersion?: string | undefined;
  readonly logger?: ILogger | undefined;
  readonly telemetry?: RecoveryTelemetry | undefined;
}

export class SqliteDatabaseBackupManager {
  private readonly databasePath: string;
  private readonly backupDirectory: string;
  private readonly applicationVersion: string;
  private readonly logger?: ILogger | undefined;
  private readonly telemetry?: RecoveryTelemetry | undefined;
  private isBackupInProgress = false;

  constructor(options: SqliteDatabaseBackupManagerOptions) {
    this.databasePath = path.resolve(options.databasePath);
    this.backupDirectory = path.resolve(
      options.backupDirectory ?? path.join(path.dirname(this.databasePath), 'backups')
    );
    this.applicationVersion = options.applicationVersion ?? '1.0.0';
    this.logger = options.logger;
    this.telemetry = options.telemetry;
  }

  public getBackupDirectory(): string {
    return this.backupDirectory;
  }

  public getDatabasePath(): string {
    return this.databasePath;
  }

  /**
   * Performs a native, consistent SQLite online backup using SQLite's backup API.
   * Flushes WAL pages, writes atomically to a temporary file, computes SHA-256 hash,
   * performs SQLite integrity verification, and stores immutable metadata.
   */
  public async createBackup(options: CreateDatabaseBackupOptions = {}): Promise<DatabaseBackupRecord> {
    if (this.isBackupInProgress) {
      throw new StorageCoreError('Another backup operation is already in progress.');
    }

    if (!fs.existsSync(this.databasePath)) {
      throw new StorageCoreError(`Source database not found at '${this.databasePath}'`);
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();
    const backupId = `bkp_sqlite_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const scope: DatabaseBackupScope = options.scope ?? { isFull: true };

    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    }

    const tempBackupPath = path.join(this.backupDirectory, `${backupId}.db.tmp`);
    const finalBackupPath = path.join(this.backupDirectory, `${backupId}.db`);
    const metadataPath = path.join(this.backupDirectory, `${backupId}.json`);

    try {
      this.logger?.info?.({
        component: 'SqliteDatabaseBackupManager',
        operation: 'createBackup',
        message: `Starting native SQLite backup '${backupId}' from '${this.databasePath}'`,
      });

      // 1. Connect to source database and checkpoint WAL
      const sourceDb = new Database(this.databasePath, { readonly: false });
      let schemaVersion = 1;
      try {
        sourceDb.pragma('wal_checkpoint(PASSIVE);');

        try {
          const row: any = sourceDb
            .prepare('SELECT max(version) as ver FROM pm_schema_migrations WHERE status = ?')
            .get('APPLIED');
          if (row?.ver) {
            schemaVersion = Number(row.ver);
          }
        } catch {
          // Schema migrations table not yet initialized
        }

        // 2. Perform native online backup into temporary destination file
        await sourceDb.backup(tempBackupPath);
      } finally {
        sourceDb.close();
      }

      // 3. Measure size and generate SHA-256 checksum
      const stat = fs.statSync(tempBackupPath);
      const sizeBytes = stat.size;
      const fileBuffer = fs.readFileSync(tempBackupPath);
      const sha256Checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // 4. Verify integrity of the generated backup file before making it official
      const probeDb = new Database(tempBackupPath, { readonly: true, timeout: 5000 });
      let integrityResult = 'ok';
      try {
        const check: any = probeDb.pragma('quick_check(1)', { simple: true });
        integrityResult = String(check);
        if (integrityResult !== 'ok') {
          throw new StorageCoreError(`Backup integrity quick_check failed: ${integrityResult}`);
        }
      } finally {
        probeDb.close();
      }

      // 5. Atomically promote the temp file to final backup file
      fs.renameSync(tempBackupPath, finalBackupPath);

      const durationMs = Date.now() - startTime;
      const record: DatabaseBackupRecord = {
        backupId,
        timestamp: startTime,
        isoTimestamp: new Date(startTime).toISOString(),
        status: 'COMPLETED',
        databasePath: this.databasePath,
        backupPath: finalBackupPath,
        sizeBytes,
        sha256Checksum,
        schemaVersion,
        applicationVersion: this.applicationVersion,
        durationMs,
        scope,
        description: options.description,
        verifiedAt: Date.now(),
        integrityCheckResult: integrityResult,
        metadata: options.metadata,
      };

      // 6. Write standalone metadata JSON
      fs.writeFileSync(metadataPath, JSON.stringify(record, null, 2), 'utf8');

      // 7. Telemetry & logging
      this.telemetry?.recordBackupSuccess(backupId, durationMs, sizeBytes, scope.isFull ? 'full' : 'scoped');

      this.logger?.info?.({
        component: 'SqliteDatabaseBackupManager',
        operation: 'createBackup',
        message: `SQLite backup '${backupId}' completed successfully in ${durationMs}ms (size: ${sizeBytes}B, sha256: ${sha256Checksum.substring(0, 12)}...)`,
      });

      // 8. Apply retention policy if requested
      if (options.retention) {
        await this.applyRetentionPolicy(options.retention);
      }

      return record;
    } catch (err: unknown) {
      if (fs.existsSync(tempBackupPath)) {
        try {
          fs.unlinkSync(tempBackupPath);
        } catch {
          // Ignored
        }
      }

      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.telemetry?.recordBackupFailure(scope.isFull ? 'full' : 'scoped', errorMsg, durationMs);

      this.logger?.error?.({
        component: 'SqliteDatabaseBackupManager',
        operation: 'createBackup',
        message: `SQLite backup '${backupId}' failed: ${errorMsg}`,
      });

      throw err;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Verifies the cryptographic checksum and database integrity of a backup artifact.
   */
  public async verifyBackup(backupId: string): Promise<BackupVerificationResult> {
    const metadata = await this.inspectBackup(backupId);
    if (!metadata) {
      return {
        isValid: false,
        backupId,
        checkedAt: Date.now(),
        errors: [`Backup '${backupId}' metadata not found`],
      };
    }

    const errors: string[] = [];
    const backupFile = metadata.backupPath;

    if (!fs.existsSync(backupFile)) {
      return {
        isValid: false,
        backupId,
        checkedAt: Date.now(),
        errors: [`Backup database file not found at '${backupFile}'`],
      };
    }

    // 1. Verify SHA-256 Checksum
    const content = fs.readFileSync(backupFile);
    const computedHash = crypto.createHash('sha256').update(content).digest('hex');

    if (computedHash !== metadata.sha256Checksum) {
      errors.push(
        `Checksum mismatch: stored '${metadata.sha256Checksum}', computed '${computedHash}' (file corrupted or modified)`
      );
    }

    // 2. Verify SQLite internal integrity
    try {
      const probeDb = new Database(backupFile, { readonly: true, timeout: 5000 });
      try {
        const check: any = probeDb.pragma('quick_check(1)', { simple: true });
        if (check !== 'ok') {
          errors.push(`SQLite quick_check failed: ${check}`);
        }
      } finally {
        probeDb.close();
      }
    } catch (dbErr: any) {
      errors.push(`Failed to open backup database: ${dbErr.message}`);
    }

    const isValid = errors.length === 0;
    this.telemetry?.recordBackupVerified(backupId, isValid);

    // Update metadata with verifiedAt if valid, or mark CORRUPTED if invalid
    const updatedRecord: DatabaseBackupRecord = {
      ...metadata,
      status: isValid ? 'COMPLETED' : 'CORRUPTED',
      verifiedAt: Date.now(),
      integrityCheckResult: isValid ? 'ok' : errors.join('; '),
    };
    const metadataPath = path.join(this.backupDirectory, `${backupId}.json`);
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(updatedRecord, null, 2), 'utf8');
    } catch {
      // Ignored
    }

    return {
      isValid,
      backupId,
      checkedAt: Date.now(),
      schemaVersion: metadata.schemaVersion,
      sizeBytes: metadata.sizeBytes,
      errors,
    };
  }

  /**
   * Lists all known database backups sorted by creation timestamp descending.
   */
  public async listBackups(): Promise<readonly DatabaseBackupRecord[]> {
    if (!fs.existsSync(this.backupDirectory)) {
      return [];
    }

    const files = fs.readdirSync(this.backupDirectory);
    const records: DatabaseBackupRecord[] = [];

    for (const f of files) {
      if (f.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(path.join(this.backupDirectory, f), 'utf8');
          const parsed = JSON.parse(raw) as DatabaseBackupRecord;
          if (parsed && parsed.backupId) {
            records.push(parsed);
          }
        } catch {
          // Ignore corrupt metadata files
        }
      }
    }

    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Inspects metadata for a single backup ID.
   */
  public async inspectBackup(backupId: string): Promise<DatabaseBackupRecord | undefined> {
    const metadataPath = path.join(this.backupDirectory, `${backupId}.json`);
    if (!fs.existsSync(metadataPath)) {
      return undefined;
    }

    try {
      const raw = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(raw) as DatabaseBackupRecord;
    } catch {
      return undefined;
    }
  }

  /**
   * Applies backup retention policy.
   * GUARANTEE: Never deletes the last verified recoverable backup copy,
   * even if it exceeds maxAgeDays or maxBackupsToRetain!
   */
  public async applyRetentionPolicy(policy: BackupRetentionPolicy): Promise<RetentionCleanupResult> {
    const allBackups = await this.listBackups();
    if (allBackups.length === 0) {
      return { retainedCount: 0, deletedCount: 0, deletedBackupIds: [] };
    }

    const maxCount = policy.maxBackupsToRetain ?? 7;
    const maxAgeMs = policy.maxAgeDays ? policy.maxAgeDays * 86400 * 1000 : undefined;
    const now = Date.now();

    // Identify candidate backups to keep and to delete
    const validBackups = allBackups.filter((b) => b.status === 'COMPLETED');
    const toDelete: string[] = [];

    // If only 1 valid backup exists, protect it unconditionally
    const lastValidBackupId = validBackups[0]?.backupId;

    allBackups.forEach((b, index) => {
      // Never delete the last verified recoverable copy!
      if (b.backupId === lastValidBackupId && validBackups.length <= 1) {
        return;
      }

      let shouldDelete = false;

      // 1. Max count policy
      if (index >= maxCount) {
        shouldDelete = true;
      }

      // 2. Max age policy
      if (maxAgeMs && now - b.timestamp > maxAgeMs) {
        shouldDelete = true;
      }

      // Check again to ensure we never delete the absolute last valid backup
      if (shouldDelete) {
        const remainingValid = validBackups.filter((v) => !toDelete.includes(v.backupId) && v.backupId !== b.backupId);
        if (b.status === 'COMPLETED' && remainingValid.length === 0) {
          // Must retain: this is the last available valid backup
          shouldDelete = false;
        }
      }

      if (shouldDelete) {
        toDelete.push(b.backupId);
      }
    });

    const deletedIds: string[] = [];
    for (const bId of toDelete) {
      const success = await this.deleteBackup(bId, false);
      if (success) {
        deletedIds.push(bId);
      }
    }

    const remaining = allBackups.length - deletedIds.length;
    this.telemetry?.updateBackupsRetained(remaining);

    return {
      retainedCount: remaining,
      deletedCount: deletedIds.length,
      deletedBackupIds: deletedIds,
    };
  }

  /**
   * Deletes a backup artifact and its metadata.
   * If force is false, refuses deletion if it is the last remaining verified backup.
   */
  public async deleteBackup(backupId: string, force: boolean = false): Promise<boolean> {
    const metadata = await this.inspectBackup(backupId);
    if (!metadata) return false;

    if (!force && metadata.status === 'COMPLETED') {
      const all = await this.listBackups();
      const valid = all.filter((b) => b.status === 'COMPLETED');
      if (valid.length <= 1) {
        this.logger?.warn?.({
          component: 'SqliteDatabaseBackupManager',
          operation: 'deleteBackup',
          message: `Refused to delete backup '${backupId}': cannot delete the last verified recoverable copy without force flag.`,
        });
        return false;
      }
    }

    const dbPath = metadata.backupPath;
    const jsonPath = path.join(this.backupDirectory, `${backupId}.json`);

    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch {
        // Ignored
      }
    }

    if (fs.existsSync(jsonPath)) {
      try {
        fs.unlinkSync(jsonPath);
      } catch {
        // Ignored
      }
    }

    return true;
  }
}
