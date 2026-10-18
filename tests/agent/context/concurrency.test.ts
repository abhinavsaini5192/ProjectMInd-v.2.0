import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';

describe('Context Concurrency & Deduplication', () => {
  it('deduplicates simultaneous refresh requests and produces consistent versions', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login timeout',
    });

    const sessionId = startResult.contextSession.contextSessionId;

    // Trigger two simultaneous refresh requests
    const [result1, result2] = await Promise.all([
      harness.sessionManager.refreshContextSession(sessionId, {
        reason: 'EXPLICIT_REQUEST',
        modifiedFiles: ['src/auth/AuthService.ts'],
      }),
      harness.sessionManager.refreshContextSession(sessionId, {
        reason: 'EXPLICIT_REQUEST',
        modifiedFiles: ['src/auth/AuthService.ts'],
      }),
    ]);

    // Both should receive identical results and not double-increment version
    expect(result1.refreshedVersion).toBe(2);
    expect(result2.refreshedVersion).toBe(2);
    expect(result1.package.packageId).toBe(result2.package.packageId);

    const session = await harness.sessionManager.getContextSession(sessionId);
    expect(session?.currentContextVersion).toBe(2);
  });
});
