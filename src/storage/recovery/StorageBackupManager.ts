import type {
  BackupMetadata,
  BackupScope,
  BackupValidationResult,
  CreateBackupOptions,
  IBackupManager,
} from './BackupTypes.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';
import * as crypto from 'crypto';

export interface StorageBackupManagerOptions {
  readonly applicationVersion?: string | undefined;
  readonly getStorageVersion?: () => Promise<number> | number;
  readonly snapshotData?: (scope: BackupScope) => Promise<string>;
  readonly logger?: ILogger | undefined;
}

export class StorageBackupManager implements IBackupManager {
  private readonly backups = new Map<string, BackupMetadata>();
  private readonly appVersion: string;

  constructor(private readonly options: StorageBackupManagerOptions = {}) {
    this.appVersion = options.applicationVersion ?? '1.0.0';
  }

  public async createBackup(options: CreateBackupOptions = {}): Promise<BackupMetadata> {
    const backupId = `bkp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const scope: BackupScope = options.scope ?? { isFull: true };
    const storageVersion = this.options.getStorageVersion
      ? await this.options.getStorageVersion()
      : 1;

    // Capture serialized data payload
    const rawData = options.payload !== undefined
      ? options.payload
      : this.options.snapshotData
        ? await this.options.snapshotData(scope)
        : JSON.stringify({ scope, timestamp: Date.now() });

    const sizeBytes = Buffer.byteLength(rawData, 'utf8');
    const integrityHash = crypto.createHash('sha256').update(rawData).digest('hex');

    const metadata: BackupMetadata = {
      backupId,
      createdAt: Date.now(),
      storageVersion,
      applicationVersion: this.appVersion,
      scope,
      sizeBytes,
      integrityHash,
      status: 'COMPLETED',
      description: options.description,
      dataSnapshot: rawData,
      metadata: options.metadata,
    };

    this.backups.set(backupId, metadata);

    this.options.logger?.info?.({
      component: 'StorageBackupManager',
      operation: 'createBackup',
      message: `Created backup '${backupId}' (size: ${sizeBytes} bytes, hash: ${integrityHash.substring(0, 8)}...)`,
    });

    return metadata;
  }

  public async listBackups(scopeFilter?: Partial<BackupScope>): Promise<readonly BackupMetadata[]> {
    let result = Array.from(this.backups.values());

    if (scopeFilter) {
      if (scopeFilter.workspaceId) {
        result = result.filter(
          (b) => b.scope.workspaceId === scopeFilter.workspaceId || b.scope.isFull
        );
      }
      if (scopeFilter.repositoryId) {
        result = result.filter(
          (b) => b.scope.repositoryId === scopeFilter.repositoryId || b.scope.isFull
        );
      }
      if (scopeFilter.isFull !== undefined) {
        result = result.filter((b) => b.scope.isFull === scopeFilter.isFull);
      }
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  public async inspectBackup(backupId: string): Promise<BackupMetadata | undefined> {
    return this.backups.get(backupId);
  }

  public async validateBackup(backupId: string): Promise<BackupValidationResult> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      return {
        isValid: false,
        backupId,
        checkedAt: Date.now(),
        errors: [`Backup '${backupId}' does not exist`],
      };
    }

    const errors: string[] = [];

    if (!backup.dataSnapshot) {
      errors.push('Backup contains no data snapshot payload');
    } else {
      const computedHash = crypto
        .createHash('sha256')
        .update(backup.dataSnapshot)
        .digest('hex');

      if (computedHash !== backup.integrityHash) {
        errors.push(
          `Integrity hash mismatch: stored '${backup.integrityHash}', computed '${computedHash}' (data corrupted)`
        );
      }
    }

    if (backup.status === 'CORRUPTED' || backup.status === 'FAILED') {
      errors.push(`Backup is in non-viable status: '${backup.status}'`);
    }

    return {
      isValid: errors.length === 0,
      backupId,
      checkedAt: Date.now(),
      errors,
    };
  }

  public async deleteBackup(backupId: string): Promise<boolean> {
    const backup = this.backups.get(backupId);
    if (!backup) return false;

    this.backups.delete(backupId);
    this.options.logger?.info?.({
      component: 'StorageBackupManager',
      operation: 'deleteBackup',
      message: `Deleted backup '${backupId}'`,
    });
    return true;
  }
}
