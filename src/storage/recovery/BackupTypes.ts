export type BackupStatus =
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'FAILED'
  | 'CORRUPTED';

export interface BackupScope {
  readonly isFull: boolean;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
}

export interface BackupMetadata {
  readonly backupId: string;
  readonly createdAt: number;
  readonly storageVersion: number;
  readonly applicationVersion: string;
  readonly scope: BackupScope;
  readonly sizeBytes: number;
  readonly integrityHash: string;
  readonly status: BackupStatus;
  readonly description?: string | undefined;
  readonly dataSnapshot?: string | undefined; // Encrypted or serialized snapshot payload
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface BackupValidationResult {
  readonly isValid: boolean;
  readonly backupId: string;
  readonly checkedAt: number;
  readonly errors: readonly string[];
}

export interface CreateBackupOptions {
  readonly scope?: BackupScope | undefined;
  readonly description?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly payload?: string | undefined;
}

export interface IBackupManager {
  createBackup(options?: CreateBackupOptions): Promise<BackupMetadata>;
  listBackups(scope?: Partial<BackupScope>): Promise<readonly BackupMetadata[]>;
  inspectBackup(backupId: string): Promise<BackupMetadata | undefined>;
  validateBackup(backupId: string): Promise<BackupValidationResult>;
  deleteBackup(backupId: string): Promise<boolean>;
}

export const IBackupManagerToken = Symbol('IBackupManager');
