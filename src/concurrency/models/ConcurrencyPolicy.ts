/**
 * Classification of operations by their concurrency characteristics and requirements.
 */
export type OperationConcurrencyClass =
  | 'READ_ONLY'        // Safe for unlimited concurrent execution without locking.
  | 'IDEMPOTENT_WRITE' // Concurrent execution safe if idempotency is preserved; checked against version.
  | 'MUTATING_WRITE'   // Requires optimistic concurrency token / version check; conflict on mismatch.
  | 'EXCLUSIVE_WRITE'  // Requires exclusive resource lock (e.g. migration, rename, bulk purge).
  | 'LONG_RUNNING';    // Long background analysis; requires stale result detection.

export type LockScopeLevel = 'WORKSPACE' | 'REPOSITORY' | 'FEATURE' | 'RESOURCE';

export interface ConcurrencyPolicy {
  readonly operationClass: OperationConcurrencyClass;
  readonly maxConcurrency?: number | undefined;
  readonly lockRequired?: boolean | undefined;
  readonly lockScope?: LockScopeLevel | undefined;
  readonly timeoutMs?: number | undefined;
  readonly retryableOnConflict?: boolean | undefined;
  readonly staleResultProtection?: boolean | undefined;
}

export const DEFAULT_CONCURRENCY_POLICIES: Record<string, ConcurrencyPolicy> = {
  featureRead: {
    operationClass: 'READ_ONLY',
    maxConcurrency: 100,
    lockRequired: false,
  },
  contextGenerate: {
    operationClass: 'READ_ONLY',
    maxConcurrency: 20,
    lockRequired: false,
    staleResultProtection: true,
  },
  knowledgeUpdate: {
    operationClass: 'IDEMPOTENT_WRITE',
    maxConcurrency: 5,
    lockRequired: true,
    lockScope: 'REPOSITORY',
    timeoutMs: 30000,
    retryableOnConflict: true,
  },
  featureMappingUpdate: {
    operationClass: 'MUTATING_WRITE',
    lockRequired: true,
    lockScope: 'FEATURE',
    timeoutMs: 15000,
    retryableOnConflict: true,
  },
  schemaMigration: {
    operationClass: 'EXCLUSIVE_WRITE',
    maxConcurrency: 1,
    lockRequired: true,
    lockScope: 'WORKSPACE',
    timeoutMs: 120000,
    retryableOnConflict: false,
  },
  repositoryRename: {
    operationClass: 'EXCLUSIVE_WRITE',
    maxConcurrency: 1,
    lockRequired: true,
    lockScope: 'REPOSITORY',
    timeoutMs: 30000,
    retryableOnConflict: false,
  },
  longRunningAnalysis: {
    operationClass: 'LONG_RUNNING',
    maxConcurrency: 3,
    lockRequired: false,
    staleResultProtection: true,
    timeoutMs: 180000,
  },
};
