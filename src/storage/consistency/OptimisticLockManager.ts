import type {
  ConcurrencyRetryOptions,
  IConcurrencyManager,
} from './ConcurrencyTypes.js';
import { VersionConflictError } from './ConcurrencyTypes.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export class OptimisticLockManager implements IConcurrencyManager {
  private readonly entityVersions = new Map<string, number>();

  constructor(private readonly logger?: ILogger | undefined) {}

  private makeKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  public registerVersion(entityType: string, entityId: string, version: number): void {
    const key = this.makeKey(entityType, entityId);
    this.entityVersions.set(key, version);
  }

  public getVersion(entityType: string, entityId: string): number | undefined {
    return this.entityVersions.get(this.makeKey(entityType, entityId));
  }

  public async checkVersion(
    entityType: string,
    entityId: string,
    expectedVersion: number
  ): Promise<void> {
    const key = this.makeKey(entityType, entityId);
    const actualVersion = this.entityVersions.get(key);

    if (actualVersion !== undefined && actualVersion !== expectedVersion) {
      this.logger?.warn?.({
        component: 'OptimisticLockManager',
        operation: 'checkVersion',
        message: `Version conflict on ${entityType} '${entityId}': expected ${expectedVersion}, actual ${actualVersion}`,
      });
      throw new VersionConflictError(entityType, entityId, expectedVersion, actualVersion);
    }
  }

  public async incrementVersion(
    entityType: string,
    entityId: string,
    expectedVersion: number
  ): Promise<number> {
    const key = this.makeKey(entityType, entityId);
    const actualVersion = this.entityVersions.get(key);

    if (actualVersion !== undefined && actualVersion !== expectedVersion) {
      this.logger?.warn?.({
        component: 'OptimisticLockManager',
        operation: 'checkVersion',
        message: `Version conflict on ${entityType} '${entityId}': expected ${expectedVersion}, actual ${actualVersion}`,
      });
      throw new VersionConflictError(entityType, entityId, expectedVersion, actualVersion);
    }

    const newVersion = expectedVersion + 1;
    this.registerVersion(entityType, entityId, newVersion);
    return newVersion;
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: ConcurrencyRetryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const initialBackoff = options.backoffMs ?? 50;
    const maxBackoff = options.maxBackoffMs ?? 1000;

    let attempt = 0;
    let currentBackoff = initialBackoff;

    while (attempt <= maxRetries) {
      try {
        return await operation();
      } catch (err: unknown) {
        if (err instanceof VersionConflictError && attempt < maxRetries) {
          attempt++;
          this.logger?.info?.({
            component: 'OptimisticLockManager',
            operation: 'retry',
            message: `Optimistic concurrency conflict detected. Retrying attempt ${attempt}/${maxRetries} after ${currentBackoff}ms`,
          });
          await new Promise((resolve) => setTimeout(resolve, currentBackoff));
          currentBackoff = Math.min(currentBackoff * 2, maxBackoff);
          continue;
        }
        throw err;
      }
    }

    throw new Error('Unreachable: retry loop terminated without return or throw');
  }
}
