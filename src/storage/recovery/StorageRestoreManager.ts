import type {
  IRestoreManager,
  RestoreOptions,
  RestoreResult,
} from './RestoreTypes.js';
import type { IBackupManager } from './BackupTypes.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';
import type { ITransactionManager } from '../consistency/TransactionTypes.js';

export interface StorageRestoreManagerOptions {
  readonly backupManager: IBackupManager;
  readonly getCurrentStorageVersion: () => Promise<number> | number;
  readonly applySnapshotData?: (data: string, options: RestoreOptions) => Promise<number>;
  readonly transactionManager?: ITransactionManager | undefined;
  readonly logger?: ILogger | undefined;
}

export class StorageRestoreManager implements IRestoreManager {
  constructor(private readonly options: StorageRestoreManagerOptions) {}

  public async validateRestore(
    options: RestoreOptions
  ): Promise<{ canRestore: boolean; errors: readonly string[] }> {
    const errors: string[] = [];

    if (!options.authorizedBy || options.authorizedBy.trim().length === 0) {
      errors.push('Restore operation requires explicit operational authorization (authorizedBy)');
    }

    const backup = await this.options.backupManager.inspectBackup(options.backupId);
    if (!backup) {
      errors.push(`Backup '${options.backupId}' does not exist`);
      return { canRestore: false, errors };
    }

    // Validate backup integrity
    const validation = await this.options.backupManager.validateBackup(options.backupId);
    if (!validation.isValid) {
      errors.push(...validation.errors);
    }

    // Validate schema compatibility
    const currentVersion = await this.options.getCurrentStorageVersion();
    if (backup.storageVersion > currentVersion && !options.force) {
      errors.push(
        `Incompatible restore: backup storage version (${backup.storageVersion}) is newer than current storage version (${currentVersion}). Run application migrations first.`
      );
    }

    if (options.type === 'SCOPED' && !options.targetWorkspaceId) {
      errors.push('Scoped restore requires specifying targetWorkspaceId');
    }

    return {
      canRestore: errors.length === 0,
      errors,
    };
  }

  public async executeRestore(options: RestoreOptions): Promise<RestoreResult> {
    const startTime = Date.now();
    const validation = await this.validateRestore(options);

    if (!validation.canRestore) {
      throw new StorageCoreError(
        `Restore validation failed:\n- ${validation.errors.join('\n- ')}`
      );
    }

    const backup = (await this.options.backupManager.inspectBackup(options.backupId))!;
    const warnings: string[] = [];

    this.options.logger?.warn?.({
      component: 'StorageRestoreManager',
      operation: 'executeRestore',
      message: `Executing ${options.type} restore from backup '${options.backupId}', authorized by '${options.authorizedBy}'`,
      details: { backupId: options.backupId, authorizedBy: options.authorizedBy },
    });

    let affectedEntities = 0;

    const performRestore = async () => {
      if (this.options.applySnapshotData && backup.dataSnapshot) {
        affectedEntities = await this.options.applySnapshotData(backup.dataSnapshot, options);
      } else {
        affectedEntities = 1;
      }
    };

    if (this.options.transactionManager) {
      await this.options.transactionManager.runInTransaction(performRestore, {
        name: `restore_${options.backupId}`,
      });
    } else {
      await performRestore();
    }

    const durationMs = Date.now() - startTime;

    this.options.logger?.info?.({
      component: 'StorageRestoreManager',
      operation: 'executeRestore',
      message: `Restore completed successfully in ${durationMs}ms (${affectedEntities} entities restored)`,
    });

    return {
      success: true,
      backupId: options.backupId,
      restoredAt: Date.now(),
      durationMs,
      affectedEntitiesCount: affectedEntities,
      message: `Restore completed successfully from backup '${options.backupId}'.`,
      warnings,
    };
  }
}
