import { describe, it, expect, beforeEach } from 'vitest';
import { OptimisticLockManager } from '../../src/storage/consistency/OptimisticLockManager.js';
import { VersionConflictError } from '../../src/storage/consistency/ConcurrencyTypes.js';
import { createConcurrencyToken } from '../../src/concurrency/models/ConcurrencyToken.js';

describe('Concurrency - Optimistic Concurrency & Tokens', () => {
  let optimisticManager: OptimisticLockManager;

  beforeEach(() => {
    optimisticManager = new OptimisticLockManager();
  });

  it('creates stable concurrency tokens with resourceId and version', () => {
    const token = createConcurrencyToken('feat-123', 5, 'feature-intelligence');
    expect(token.resourceId).toBe('feat-123');
    expect(token.version).toBe(5);
    expect(token.source).toBe('feature-intelligence');
    expect(token.generatedAt).toBeLessThanOrEqual(Date.now());
  });

  it('allows updates when expected version matches actual version', async () => {
    optimisticManager.registerVersion('Feature', 'feat-1', 1);

    await expect(optimisticManager.checkVersion('Feature', 'feat-1', 1)).resolves.not.toThrow();

    const newVersion = await optimisticManager.incrementVersion('Feature', 'feat-1', 1);
    expect(newVersion).toBe(2);
    expect(optimisticManager.getVersion('Feature', 'feat-1')).toBe(2);
  });

  it('throws VersionConflictError on stale expected version', async () => {
    optimisticManager.registerVersion('Knowledge', 'k-auth', 10);

    // Caller expects version 9, but actual is 10
    await expect(optimisticManager.checkVersion('Knowledge', 'k-auth', 9)).rejects.toThrow(
      VersionConflictError
    );

    try {
      await optimisticManager.checkVersion('Knowledge', 'k-auth', 9);
    } catch (err) {
      expect(err).toBeInstanceOf(VersionConflictError);
      const conflict = err as VersionConflictError;
      expect(conflict.expectedVersion).toBe(9);
      expect(conflict.actualVersion).toBe(10);
      expect(conflict.entityType).toBe('Knowledge');
    }
  });

  it('prevents lost updates in concurrent modification race', async () => {
    optimisticManager.registerVersion('FeatureMapping', 'map-1', 1);

    // Two agents attempt to update map-1 starting from version 1
    const agentA = async () => {
      return optimisticManager.incrementVersion('FeatureMapping', 'map-1', 1);
    };

    const agentB = async () => {
      return optimisticManager.incrementVersion('FeatureMapping', 'map-1', 1);
    };

    // Agent A executes and commits version 2
    const resultA = await agentA();
    expect(resultA).toBe(2);

    // Agent B attempts using stale version 1 -> must fail
    await expect(agentB()).rejects.toThrow(VersionConflictError);
    expect(optimisticManager.getVersion('FeatureMapping', 'map-1')).toBe(2);
  });

  it('supports automatic retry loop for transient version conflicts', async () => {
    let callCount = 0;
    optimisticManager.registerVersion('Task', 'task-1', 1);

    // Operation simulates conflict on first attempt, then succeeds on retry
    const result = await optimisticManager.executeWithRetry(
      async () => {
        callCount++;
        const current = optimisticManager.getVersion('Task', 'task-1') ?? 1;
        if (callCount === 1) {
          // Simulate concurrent writer incrementing version behind our back
          optimisticManager.registerVersion('Task', 'task-1', 2);
          throw new VersionConflictError('Task', 'task-1', 1, 2);
        }
        return optimisticManager.incrementVersion('Task', 'task-1', current);
      },
      { maxRetries: 2, backoffMs: 10 }
    );

    expect(callCount).toBe(2);
    expect(result).toBe(3);
    expect(optimisticManager.getVersion('Task', 'task-1')).toBe(3);
  });
});
