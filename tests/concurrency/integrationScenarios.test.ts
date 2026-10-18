import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLockManager } from '../../src/concurrency/locking/ResourceLockManager.js';
import { CoordinationService } from '../../src/concurrency/coordination/CoordinationService.js';
import { OptimisticLockManager } from '../../src/storage/consistency/OptimisticLockManager.js';
import { VersionConflictError } from '../../src/storage/consistency/ConcurrencyTypes.js';
import { StaleResultDetector } from '../../src/concurrency/consistency/StaleResultDetector.js';
import { RequestCoalescer } from '../../src/concurrency/coalescing/RequestCoalescer.js';

describe('Concurrency - Production Integration Scenarios (Sections 51-55)', () => {
  let lockManager: ResourceLockManager;
  let coordination: CoordinationService;
  let optimisticManager: OptimisticLockManager;
  let coalescer: RequestCoalescer;

  beforeEach(() => {
    lockManager = new ResourceLockManager();
    coordination = new CoordinationService();
    optimisticManager = new OptimisticLockManager();
    coalescer = new RequestCoalescer();
  });

  /**
   * Scenario 1 (Section 51):
   * Agent A updates Knowledge Version 10 -> 11 while Agent B requests Context.
   * Context must either use version 10 consistently or refresh to version 11,
   * never producing a falsely labeled hybrid state.
   */
  it('Scenario 1: Context request preserves version consistency during concurrent knowledge update', async () => {
    let currentKnowledgeVersion = 10;
    const knowledgeStore = new Map<number, { authFeature: string; paymentFeature: string }>();
    knowledgeStore.set(10, { authFeature: 'OAuth2_v1', paymentFeature: 'Stripe_v1' });
    knowledgeStore.set(11, { authFeature: 'OAuth2_v2_PKCE', paymentFeature: 'Stripe_v1' });

    // Agent A updates Knowledge from 10 to 11
    const agentAKnowledgeUpdate = async () => {
      await new Promise((r) => setTimeout(r, 20));
      currentKnowledgeVersion = 11;
      return 11;
    };

    // Agent B requests Context
    const agentBContextGeneration = async () => {
      const capturedVersion = currentKnowledgeVersion;
      // Simulate context assembly reading knowledge state
      const data = knowledgeStore.get(capturedVersion)!;
      await new Promise((r) => setTimeout(r, 30));

      // Validate freshness before returning derived context
      const freshness = await StaleResultDetector.checkFreshness(
        'repo-mind',
        capturedVersion,
        async () => currentKnowledgeVersion
      );

      return {
        contextVersion: capturedVersion,
        data,
        isFresh: freshness.isFresh,
      };
    };

    const [updateResult, contextResult] = await Promise.all([
      agentAKnowledgeUpdate(),
      agentBContextGeneration(),
    ]);

    expect(updateResult).toBe(11);
    // Context package accurately states what version it was generated against
    expect(contextResult.data).toEqual(knowledgeStore.get(contextResult.contextVersion));
    // If knowledge evolved, isFresh is flagged false rather than masquerading as current
    if (contextResult.contextVersion === 10) {
      expect(contextResult.isFresh).toBe(false);
    }
  });

  /**
   * Scenario 2 (Section 52):
   * Two workers receive same KnowledgeUpdate event.
   * One processes, duplicate is safely ignored.
   */
  it('Scenario 2: Duplicate KnowledgeUpdate events are safely deduplicated and processed once', async () => {
    let executionCount = 0;
    const processedUpdates = new Set<string>();

    const handleUpdate = async (idempotencyKey: string) => {
      const lockKey = `update:idempotency:${idempotencyKey}`;
      const lockRes = await lockManager.acquire(lockKey, `worker-${Math.random()}`);

      if (!lockRes.success) {
        // Another worker is already processing or has processed this update
        return { status: 'DUPLICATE_IGNORED' };
      }

      try {
        if (processedUpdates.has(idempotencyKey)) {
          return { status: 'DUPLICATE_IGNORED' };
        }
        executionCount++;
        processedUpdates.add(idempotencyKey);
        await new Promise((r) => setTimeout(r, 15));
        return { status: 'APPLIED', executionCount };
      } finally {
        await lockManager.release(lockRes.lock!.lockId, lockRes.lock!.ownerId);
      }
    };

    const duplicateKey = 'evt-ku-10928';
    const [resA, resB] = await Promise.all([
      handleUpdate(duplicateKey),
      handleUpdate(duplicateKey),
    ]);

    expect(executionCount).toBe(1);
    const statuses = [resA.status, resB.status];
    expect(statuses).toContain('APPLIED');
    expect(statuses).toContain('DUPLICATE_IGNORED');
  });

  /**
   * Scenario 3 (Section 53):
   * Two ProjectMind instances start simultaneously and detect pending migration.
   * Only one migration execution occurs; other instance waits or observes safely.
   */
  it('Scenario 3: Simultaneous instance startup allows exactly one migration runner', async () => {
    let migrationRunCount = 0;
    let migrationApplied = false;
    const migrationLockKey = 'workspace:mind:migration:schema-v1';

    const startInstance = async (instanceId: string) => {
      const lock = await lockManager.acquire(migrationLockKey, instanceId, {
        ttlMs: 500,
        waitTimeoutMs: 50,
      });

      if (!lock.success) {
        // Second instance observes migration in-flight and waits
        return { instanceId, role: 'OBSERVER', ranMigration: false };
      }

      try {
        if (!migrationApplied) {
          migrationRunCount++;
          await new Promise((r) => setTimeout(r, 30));
          migrationApplied = true;
          return { instanceId, role: 'MIGRATOR', ranMigration: true };
        }
        return { instanceId, role: 'OBSERVER', ranMigration: false };
      } finally {
        await lockManager.release(lock.lock!.lockId, instanceId);
      }
    };

    const [inst1, inst2] = await Promise.all([
      startInstance('instance-alpha'),
      startInstance('instance-beta'),
    ]);

    expect(migrationRunCount).toBe(1);
    const migrators = [inst1, inst2].filter((i) => i.ranMigration);
    const observers = [inst1, inst2].filter((i) => !i.ranMigration);

    expect(migrators.length).toBe(1);
    expect(observers.length).toBe(1);
  });

  /**
   * Scenario 4 (Section 54):
   * Two agents modify different repositories in the same workspace.
   * Operations proceed independently without a global workspace lock.
   */
  it('Scenario 4: Independent repositories in same workspace modify concurrently without blocking', async () => {
    const keyRepoA = ResourceLockManager.buildKey('ws-enterprise', 'repo-frontend', 'feature', 'edit');
    const keyRepoB = ResourceLockManager.buildKey('ws-enterprise', 'repo-backend', 'feature', 'edit');

    const lockRepoA = await lockManager.acquire(keyRepoA, 'agent-fe');
    const lockRepoB = await lockManager.acquire(keyRepoB, 'agent-be');

    // Both must succeed simultaneously
    expect(lockRepoA.success).toBe(true);
    expect(lockRepoB.success).toBe(true);

    expect(await lockManager.isLocked(keyRepoA)).toBe(true);
    expect(await lockManager.isLocked(keyRepoB)).toBe(true);

    await lockManager.release(lockRepoA.lock!.lockId, 'agent-fe');
    await lockManager.release(lockRepoB.lock!.lockId, 'agent-be');
  });

  /**
   * Scenario 5 (Section 55):
   * Agent A updates Feature X.
   * Agent B deletes Feature X.
   * Both start from version 20.
   * Only one operation commits version 21; the other receives deterministic conflict.
   */
  it('Scenario 5: Concurrent update vs delete on same feature starting from same version commits exactly once', async () => {
    optimisticManager.registerVersion('Feature', 'feat-x', 20);

    let committedAction = '';
    let conflictCount = 0;

    const agentAUpdate = async () => {
      try {
        await optimisticManager.incrementVersion('Feature', 'feat-x', 20);
        committedAction = 'UPDATE_COMMITTED';
      } catch (err) {
        if (err instanceof VersionConflictError) {
          conflictCount++;
        }
      }
    };

    const agentBDelete = async () => {
      try {
        await optimisticManager.incrementVersion('Feature', 'feat-x', 20);
        committedAction = 'DELETE_COMMITTED';
      } catch (err) {
        if (err instanceof VersionConflictError) {
          conflictCount++;
        }
      }
    };

    // Both attempt concurrently
    await Promise.all([agentAUpdate(), agentBDelete()]);

    expect(optimisticManager.getVersion('Feature', 'feat-x')).toBe(21);
    expect(conflictCount).toBe(1);
    expect(['UPDATE_COMMITTED', 'DELETE_COMMITTED']).toContain(committedAction);
  });
});
