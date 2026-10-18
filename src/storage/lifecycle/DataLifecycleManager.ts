import type {
  IDataLifecycleManager,
  LifecycleEntity,
  LifecycleEvaluationResult,
} from './DataLifecycleTypes.js';
import { RetentionPolicy } from './RetentionPolicy.js';
import { DeletionPolicy } from './DeletionPolicy.js';
import type { IArchiveStore } from './ArchivalPolicy.js';
import { InMemoryArchiveStore } from './ArchivalPolicy.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export interface DataLifecycleManagerOptions {
  readonly retentionPolicy?: RetentionPolicy | undefined;
  readonly deletionPolicy?: DeletionPolicy | undefined;
  readonly archiveStore?: IArchiveStore | undefined;
  readonly logger?: ILogger | undefined;
}

export class DataLifecycleManager implements IDataLifecycleManager {
  private readonly retentionPolicy: RetentionPolicy;
  private readonly deletionPolicy: DeletionPolicy;
  private readonly archiveStore: IArchiveStore;
  private readonly logger?: ILogger | undefined;

  constructor(options: DataLifecycleManagerOptions = {}) {
    this.retentionPolicy = options.retentionPolicy ?? new RetentionPolicy();
    this.deletionPolicy = options.deletionPolicy ?? new DeletionPolicy();
    this.archiveStore = options.archiveStore ?? new InMemoryArchiveStore();
    this.logger = options.logger;
  }

  public evaluate(entity: LifecycleEntity): LifecycleEvaluationResult {
    return this.retentionPolicy.evaluate(entity);
  }

  public softDelete(
    entity: LifecycleEntity,
    deletedBy: string,
    reason?: string
  ): LifecycleEntity {
    this.deletionPolicy.assertCanDelete(entity.entityType, false);

    if (entity.isSoftDeleted) {
      return entity; // Already soft deleted, idempotent
    }

    const updatedEntity: LifecycleEntity = {
      ...entity,
      isSoftDeleted: true,
      state: 'DELETED',
      updatedAt: Date.now(),
      version: entity.version + 1,
      softDeleteMetadata: {
        deletedAt: Date.now(),
        deletedBy,
        deletionReason: reason,
        deletionVersion: entity.version + 1,
      },
    };

    this.logger?.info?.({
      component: 'DataLifecycleManager',
      operation: 'softDelete',
      message: `Soft-deleted ${entity.entityType} '${entity.entityId}' by '${deletedBy}' (reason: ${reason ?? 'none'})`,
    });

    return updatedEntity;
  }

  public async archive(entity: LifecycleEntity): Promise<LifecycleEntity> {
    await this.archiveStore.archive(entity);

    const updatedEntity: LifecycleEntity = {
      ...entity,
      state: 'ARCHIVED',
      updatedAt: Date.now(),
      version: entity.version + 1,
    };

    this.logger?.info?.({
      component: 'DataLifecycleManager',
      operation: 'archive',
      message: `Archived ${entity.entityType} '${entity.entityId}' to archive store`,
    });

    return updatedEntity;
  }

  public async restore(entityId: string, entityType: string): Promise<LifecycleEntity> {
    const pkg = await this.archiveStore.retrieveByEntity(entityType, entityId);
    if (!pkg) {
      throw new StorageCoreError(
        `Cannot restore ${entityType} '${entityId}': no archive package found.`
      );
    }

    const restored = await this.archiveStore.restore(pkg.archiveId);

    this.logger?.info?.({
      component: 'DataLifecycleManager',
      operation: 'restore',
      message: `Restored ${entityType} '${entityId}' from archive '${pkg.archiveId}'`,
    });

    return restored;
  }

  public async purge(entity: LifecycleEntity): Promise<boolean> {
    this.deletionPolicy.assertCanDelete(entity.entityType, true);

    const pkg = await this.archiveStore.retrieveByEntity(entity.entityType, entity.entityId);
    if (pkg) {
      await this.archiveStore.purgeArchive(pkg.archiveId);
    }

    this.logger?.info?.({
      component: 'DataLifecycleManager',
      operation: 'purge',
      message: `Purged entity ${entity.entityType} '${entity.entityId}'`,
    });

    return true;
  }

  public explain(entity: LifecycleEntity): string {
    const evaluation = this.evaluate(entity);
    const strategy = this.deletionPolicy.getStrategy(entity.entityType);
    const canDelete = this.deletionPolicy.canDelete(entity.entityType);

    return `Lifecycle Analysis for ${entity.entityType} [${entity.entityId}]:
- Current State: ${entity.state}
- Recommended State: ${evaluation.recommendedState}
- Reason: ${evaluation.reason}
- Matched Rule: ${evaluation.matchedRuleName ?? 'Default Policy'}
- Deletion Strategy: ${strategy}
- Deletable: ${canDelete ? 'YES' : 'NO (PROTECTED/IMMUTABLE)'}
- Soft-Deleted: ${entity.isSoftDeleted ? `YES (by ${entity.softDeleteMetadata?.deletedBy} at ${new Date(entity.softDeleteMetadata?.deletedAt ?? 0).toISOString()})` : 'NO'}`;
  }
}
