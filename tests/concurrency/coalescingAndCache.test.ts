import { describe, it, expect, beforeEach } from 'vitest';
import { RequestCoalescer } from '../../src/concurrency/coalescing/RequestCoalescer.js';

describe('Concurrency - RequestCoalescer & Cache Concurrency', () => {
  let coalescer: RequestCoalescer;

  beforeEach(() => {
    coalescer = new RequestCoalescer();
  });

  it('coalesces multiple concurrent identical requests into a single computation', async () => {
    let computeCount = 0;

    const expensiveOperation = async () => {
      computeCount++;
      await new Promise((r) => setTimeout(r, 40));
      return { contextId: 'ctx-100', tokenCount: 4200 };
    };

    const key = coalescer.buildKey({
      workspaceId: 'ws-mind',
      repositoryId: 'repo-mind',
      operation: 'generate_context',
      knowledgeVersion: 12,
      parameters: { format: 'markdown', budget: 4000 },
    });

    // Launch 5 concurrent calls with the same key
    const results = await Promise.all([
      coalescer.coalesce(key, expensiveOperation),
      coalescer.coalesce(key, expensiveOperation),
      coalescer.coalesce(key, expensiveOperation),
      coalescer.coalesce(key, expensiveOperation),
      coalescer.coalesce(key, expensiveOperation),
    ]);

    expect(computeCount).toBe(1);
    expect(coalescer.totalCoalesced).toBe(4);
    for (const res of results) {
      expect(res.contextId).toBe('ctx-100');
      expect(res.tokenCount).toBe(4200);
    }
    // After completion, coalescer map is clean
    expect(coalescer.activeCount()).toBe(0);
    expect(coalescer.isInFlight(key)).toBe(false);
  });

  it('safely propagates errors to all coalesced callers', async () => {
    let executionAttempts = 0;

    const failingOperation = async () => {
      executionAttempts++;
      await new Promise((r) => setTimeout(r, 20));
      throw new Error('Downstream model rate-limited');
    };

    const key = 'ws:ws-1|repo:repo-1|op:analysis';

    const p1 = coalescer.coalesce(key, failingOperation);
    const p2 = coalescer.coalesce(key, failingOperation);
    const p3 = coalescer.coalesce(key, failingOperation);

    await expect(p1).rejects.toThrow('Downstream model rate-limited');
    await expect(p2).rejects.toThrow('Downstream model rate-limited');
    await expect(p3).rejects.toThrow('Downstream model rate-limited');

    expect(executionAttempts).toBe(1);
    expect(coalescer.activeCount()).toBe(0);
  });

  it('separates coalescing keys when security scopes or principals differ', () => {
    const keyUser1 = coalescer.buildKey({
      workspaceId: 'ws-mind',
      repositoryId: 'repo-mind',
      principalId: 'user-alice',
      securityScopes: ['read:features'],
      operation: 'get_context',
      knowledgeVersion: 5,
    });

    const keyUser2 = coalescer.buildKey({
      workspaceId: 'ws-mind',
      repositoryId: 'repo-mind',
      principalId: 'user-bob',
      securityScopes: ['read:features'],
      operation: 'get_context',
      knowledgeVersion: 5,
    });

    const keyAdmin = coalescer.buildKey({
      workspaceId: 'ws-mind',
      repositoryId: 'repo-mind',
      principalId: 'user-alice',
      securityScopes: ['read:features', 'read:admin'],
      operation: 'get_context',
      knowledgeVersion: 5,
    });

    expect(keyUser1).not.toBe(keyUser2);
    expect(keyUser1).not.toBe(keyAdmin);
  });

  it('separates coalescing keys when knowledge versions differ', () => {
    const keyV1 = coalescer.buildKey({
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      operation: 'context',
      knowledgeVersion: 1,
    });

    const keyV2 = coalescer.buildKey({
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      operation: 'context',
      knowledgeVersion: 2,
    });

    expect(keyV1).not.toBe(keyV2);
  });
});
