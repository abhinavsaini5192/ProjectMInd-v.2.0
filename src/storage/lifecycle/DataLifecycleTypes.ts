export type DataLifecycleState =
  | 'ACTIVE'
  | 'STALE'
  | 'ARCHIVABLE'
  | 'ARCHIVED'
  | 'DELETABLE'
  | 'DELETED';

export type DeletionStrategy =
  | 'SOFT_DELETE'
  | 'PHYSICAL_PURGE'
  | 'ARCHIVE_THEN_DELETE';

export type CascadeAction =
  | 'CASCADE'
  | 'RESTRICT'
  | 'DETACH'
  | 'ARCHIVE'
  | 'SOFT_DELETE';

export interface SoftDeleteMetadata {
  readonly deletedAt: number;
  readonly deletedBy: string;
  readonly deletionReason?: string | undefined;
  readonly deletionVersion: number;
}

export interface LifecycleEntity<T = unknown> {
  readonly entityType: string;
  readonly entityId: string;
  readonly workspaceId: string;
  readonly repositoryId?: string | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastAccessedAt?: number | undefined;
  readonly version: number;
  readonly state: DataLifecycleState;
  readonly isSoftDeleted: boolean;
  readonly softDeleteMetadata?: SoftDeleteMetadata | undefined;
  readonly payload: T;
}

export interface LifecycleEvaluationResult {
  readonly entityType: string;
  readonly entityId: string;
  readonly currentState: DataLifecycleState;
  readonly recommendedState: DataLifecycleState;
  readonly reason: string;
  readonly matchedRuleName?: string | undefined;
}

export interface IDataLifecycleManager {
  evaluate(entity: LifecycleEntity): LifecycleEvaluationResult;
  softDelete(
    entity: LifecycleEntity,
    deletedBy: string,
    reason?: string
  ): LifecycleEntity;
  archive(entity: LifecycleEntity): Promise<LifecycleEntity>;
  restore(entityId: string, entityType: string): Promise<LifecycleEntity>;
  purge(entity: LifecycleEntity): Promise<boolean>;
  explain(entity: LifecycleEntity): string;
}

export const IDataLifecycleManagerToken = Symbol('IDataLifecycleManager');
