export type RestoreType = 'FULL' | 'SCOPED' | 'POINT_IN_TIME';

export interface RestoreOptions {
  readonly backupId: string;
  readonly type: RestoreType;
  readonly authorizedBy: string;
  readonly targetWorkspaceId?: string | undefined;
  readonly targetRepositoryId?: string | undefined;
  readonly force?: boolean | undefined;
}

export interface RestoreResult {
  readonly success: boolean;
  readonly backupId: string;
  readonly restoredAt: number;
  readonly durationMs: number;
  readonly affectedEntitiesCount: number;
  readonly message: string;
  readonly warnings: readonly string[];
}

export interface IRestoreManager {
  validateRestore(options: RestoreOptions): Promise<{ canRestore: boolean; errors: readonly string[] }>;
  executeRestore(options: RestoreOptions): Promise<RestoreResult>;
}

export const IRestoreManagerToken = Symbol('IRestoreManager');
