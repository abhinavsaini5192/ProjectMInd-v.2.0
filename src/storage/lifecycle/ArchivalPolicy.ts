import type { LifecycleEntity } from './DataLifecycleTypes.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import * as crypto from 'crypto';

export interface ArchivePackage<T = unknown> {
  readonly archiveId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly workspaceId: string;
  readonly repositoryId?: string | undefined;
  readonly originalVersion: number;
  readonly archivedAt: number;
  readonly checksum: string;
  readonly payload: T;
}

export interface ArchiveQuery {
  readonly entityType?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
}

export interface IArchiveStore {
  archive<T>(entity: LifecycleEntity<T>): Promise<ArchivePackage<T>>;
  retrieve<T>(archiveId: string): Promise<ArchivePackage<T> | undefined>;
  retrieveByEntity<T>(entityType: string, entityId: string): Promise<ArchivePackage<T> | undefined>;
  list(query?: ArchiveQuery): Promise<readonly ArchivePackage[]>;
  restore<T>(archiveId: string): Promise<LifecycleEntity<T>>;
  purgeArchive(archiveId: string): Promise<boolean>;
}

export class InMemoryArchiveStore implements IArchiveStore {
  private readonly archives = new Map<string, ArchivePackage<any>>();
  private readonly entityLookup = new Map<string, string>(); // `${entityType}:${entityId}` -> archiveId

  public async archive<T>(entity: LifecycleEntity<T>): Promise<ArchivePackage<T>> {
    const archiveId = `arc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const serialized = JSON.stringify(entity.payload !== undefined ? entity.payload : null);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

    const pkg: ArchivePackage<T> = {
      archiveId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      workspaceId: entity.workspaceId,
      repositoryId: entity.repositoryId,
      originalVersion: entity.version,
      archivedAt: Date.now(),
      checksum,
      payload: entity.payload,
    };

    this.archives.set(archiveId, pkg);
    this.entityLookup.set(`${entity.entityType}:${entity.entityId}`, archiveId);
    return pkg;
  }

  public async retrieve<T>(archiveId: string): Promise<ArchivePackage<T> | undefined> {
    return this.archives.get(archiveId) as ArchivePackage<T> | undefined;
  }

  public async retrieveByEntity<T>(
    entityType: string,
    entityId: string
  ): Promise<ArchivePackage<T> | undefined> {
    const archiveId = this.entityLookup.get(`${entityType}:${entityId}`);
    return archiveId ? (this.archives.get(archiveId) as ArchivePackage<T> | undefined) : undefined;
  }

  public async list(query?: ArchiveQuery): Promise<readonly ArchivePackage[]> {
    let result = Array.from(this.archives.values());

    if (query) {
      if (query.entityType) {
        result = result.filter((p) => p.entityType === query.entityType);
      }
      if (query.workspaceId) {
        result = result.filter((p) => p.workspaceId === query.workspaceId);
      }
      if (query.repositoryId) {
        result = result.filter((p) => p.repositoryId === query.repositoryId);
      }
    }

    return result;
  }

  public async restore<T>(archiveId: string): Promise<LifecycleEntity<T>> {
    const pkg = this.archives.get(archiveId);
    if (!pkg) {
      throw new StorageCoreError(`Archive package '${archiveId}' not found for restore`);
    }

    // Verify checksum
    const serialized = JSON.stringify(pkg.payload);
    const computedChecksum = crypto.createHash('sha256').update(serialized).digest('hex');
    if (computedChecksum !== pkg.checksum) {
      throw new StorageCoreError(
        `Archive checksum mismatch for '${archiveId}': package may be corrupted`
      );
    }

    const restoredEntity: LifecycleEntity<T> = {
      entityType: pkg.entityType,
      entityId: pkg.entityId,
      workspaceId: pkg.workspaceId,
      repositoryId: pkg.repositoryId,
      createdAt: pkg.archivedAt,
      updatedAt: Date.now(),
      version: pkg.originalVersion + 1,
      state: 'ACTIVE',
      isSoftDeleted: false,
      payload: pkg.payload as T,
    };

    return restoredEntity;
  }

  public async purgeArchive(archiveId: string): Promise<boolean> {
    const pkg = this.archives.get(archiveId);
    if (!pkg) return false;

    this.archives.delete(archiveId);
    this.entityLookup.delete(`${pkg.entityType}:${pkg.entityId}`);
    return true;
  }
}
