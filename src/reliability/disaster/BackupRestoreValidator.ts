import type { BackupMetadata, BackupValidationResult } from '../../storage/recovery/BackupTypes.js';
import type { RestoreOptions } from '../../storage/recovery/RestoreTypes.js';

export interface RestoreValidationAssessment {
  readonly canRestore: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly backupDetails?: BackupMetadata | undefined;
}

export class BackupRestoreValidator {
  /**
   * Validates a backup artifact before it is admitted to storage or eligible for restore.
   */
  public static validateBackup(backup?: BackupMetadata): BackupValidationResult {
    const errors: string[] = [];

    if (!backup) {
      return {
        isValid: false,
        backupId: 'unknown',
        checkedAt: Date.now(),
        errors: ['Backup metadata is null or undefined'],
      };
    }

    if (!backup.backupId || backup.backupId.trim().length === 0) {
      errors.push('Missing valid backupId');
    }

    if (backup.createdAt <= 0 || backup.createdAt > Date.now() + 60000) {
      errors.push('Invalid backup creation timestamp');
    }

    if (!backup.storageVersion || backup.storageVersion <= 0) {
      errors.push('Invalid or missing storageVersion');
    }

    if (!backup.integrityHash || backup.integrityHash.trim().length === 0) {
      errors.push('Missing integrity hash');
    }

    if (backup.status !== 'COMPLETED') {
      errors.push(`Backup status is '${backup.status}', expected 'COMPLETED'`);
    }

    return {
      isValid: errors.length === 0,
      backupId: backup.backupId,
      checkedAt: Date.now(),
      errors,
    };
  }

  /**
   * Validates a proposed restore operation against the current application and storage state.
   */
  public static validateRestore(
    options: RestoreOptions,
    backup: BackupMetadata | undefined,
    currentStorageVersion: number,
    currentAppVersion: string = '1.0.0'
  ): RestoreValidationAssessment {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Authorization check
    if (!options.authorizedBy || options.authorizedBy.trim().length === 0) {
      errors.push('Restore operation rejected: missing authorizedBy identity');
    }

    // 2. Backup existence & integrity
    if (!backup) {
      errors.push(`Restore operation rejected: backup '${options.backupId}' not found`);
      return { canRestore: false, errors, warnings };
    }

    const backupValidation = this.validateBackup(backup);
    if (!backupValidation.isValid) {
      errors.push(...backupValidation.errors.map((e) => `Backup integrity failure: ${e}`));
    }

    // 3. Schema Version Compatibility
    if (backup.storageVersion > currentStorageVersion) {
      errors.push(
        `Incompatible backup schema: backup version (${backup.storageVersion}) is newer than current storage version (${currentStorageVersion})`
      );
    } else if (backup.storageVersion < currentStorageVersion && !options.force) {
      warnings.push(
        `Backup version (${backup.storageVersion}) is older than current storage (${currentStorageVersion}); migration may be required after restore`
      );
    }

    // 4. Scope matching
    if (options.type === 'SCOPED' && !options.targetWorkspaceId) {
      errors.push('Scoped restore requested but targetWorkspaceId was not specified');
    }

    return {
      canRestore: errors.length === 0,
      errors,
      warnings,
      backupDetails: backup,
    };
  }
}
