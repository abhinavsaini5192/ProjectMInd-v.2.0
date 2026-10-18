import { StorageCoreError } from '../types/StorageErrors.js';

export class VersionConflictError extends StorageCoreError {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
    message?: string
  ) {
    super(
      message ??
        `Optimistic concurrency conflict on ${entityType} '${entityId}': expected version ${expectedVersion}, but found version ${actualVersion}`
    );
    this.name = 'VersionConflictError';
  }
}

export interface OptimisticVersionedEntity {
  readonly id: string;
  readonly version: number;
  readonly updatedAt?: string | number | undefined;
}

export interface ConcurrencyRetryOptions {
  readonly maxRetries?: number | undefined;
  readonly backoffMs?: number | undefined;
  readonly maxBackoffMs?: number | undefined;
}

export interface IConcurrencyManager {
  checkVersion(entityType: string, entityId: string, expectedVersion: number): Promise<void>;
  registerVersion(entityType: string, entityId: string, version: number): void;
  incrementVersion(entityType: string, entityId: string, expectedVersion: number): Promise<number>;
  getVersion(entityType: string, entityId: string): number | undefined;
  executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: ConcurrencyRetryOptions
  ): Promise<T>;
}

export const IConcurrencyManagerToken = Symbol('IConcurrencyManager');
