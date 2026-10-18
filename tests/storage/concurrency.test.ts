import { describe, it, expect } from 'vitest';
import { OptimisticLockManager } from '../../src/storage/consistency/OptimisticLockManager';
import { VersionConflictError } from '../../src/storage/consistency/ConcurrencyTypes';

describe('Phase 8.4 - Concurrency Control & Optimistic Versioning', () => {
  it('should track and check matching versions correctly', async () => {
    const lockManager = new OptimisticLockManager();
    lockManager.registerVersion('Feature', 'feat-100', 1);

    expect(lockManager.getVersion('Feature', 'feat-100')).toBe(1);
    await expect(lockManager.checkVersion('Feature', 'feat-100', 1)).resolves.not.toThrow();
  });

  it('should throw VersionConflictError when expected version does not match', async () => {
    const lockManager = new OptimisticLockManager();
    lockManager.registerVersion('KnowledgeGraph', 'kg-1', 5);

    await expect(lockManager.checkVersion('KnowledgeGraph', 'kg-1', 4)).rejects.toThrow(
      VersionConflictError
    );

    try {
      await lockManager.checkVersion('KnowledgeGraph', 'kg-1', 4);
    } catch (err: any) {
      expect(err).toBeInstanceOf(VersionConflictError);
      expect(err.entityType).toBe('KnowledgeGraph');
      expect(err.entityId).toBe('kg-1');
      expect(err.expectedVersion).toBe(4);
      expect(err.actualVersion).toBe(5);
    }
  });

  it('should increment version atomically after checking', async () => {
    const lockManager = new OptimisticLockManager();
    lockManager.registerVersion('AgentSession', 'sess-1', 2);

    const nextVer = await lockManager.incrementVersion('AgentSession', 'sess-1', 2);
    expect(nextVer).toBe(3);
    expect(lockManager.getVersion('AgentSession', 'sess-1')).toBe(3);

    // Old version 2 should now be rejected
    await expect(lockManager.checkVersion('AgentSession', 'sess-1', 2)).rejects.toThrow(
      VersionConflictError
    );
  });

  it('should execute retry logic on VersionConflictError and succeed', async () => {
    const lockManager = new OptimisticLockManager();
    let attempts = 0;

    const result = await lockManager.executeWithRetry(async () => {
      attempts++;
      if (attempts < 3) {
        throw new VersionConflictError('Feature', 'feat-2', 1, 2);
      }
      return 'success_on_retry';
    }, { maxRetries: 4, backoffMs: 5 });

    expect(result).toBe('success_on_retry');
    expect(attempts).toBe(3);
  });

  it('should throw VersionConflictError when maxRetries is exceeded', async () => {
    const lockManager = new OptimisticLockManager();
    let attempts = 0;

    await expect(
      lockManager.executeWithRetry(async () => {
        attempts++;
        throw new VersionConflictError('Feature', 'feat-2', 1, 2);
      }, { maxRetries: 2, backoffMs: 5 })
    ).rejects.toThrow(VersionConflictError);

    expect(attempts).toBe(3); // Initial attempt + 2 retries
  });

  it('should not retry on non-concurrency errors', async () => {
    const lockManager = new OptimisticLockManager();
    let attempts = 0;

    await expect(
      lockManager.executeWithRetry(async () => {
        attempts++;
        throw new Error('Fatal database constraint violation');
      }, { maxRetries: 3, backoffMs: 5 })
    ).rejects.toThrow('Fatal database constraint violation');

    expect(attempts).toBe(1);
  });
});
