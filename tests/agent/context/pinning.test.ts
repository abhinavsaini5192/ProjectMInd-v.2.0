import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';
import { ContextPinError } from '../../../src/agent/context/errors/AgentContextError.js';

describe('Context Pinning & Retention', () => {
  it('pins feature, resource, and section', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login timeout',
    });

    const contextSessionId = startResult.contextSession.contextSessionId;

    // Pin Feature
    const featPin = await harness.sessionManager.pinContext(contextSessionId, {
      type: 'FEATURE',
      targetId: 'feat-auth',
      reason: 'Must remain in context throughout debugging',
    });
    expect(featPin.pinId).toBeDefined();
    expect(featPin.targetId).toBe('feat-auth');

    // Pin Resource
    const resPin = await harness.sessionManager.pinContext(contextSessionId, {
      type: 'RESOURCE',
      targetId: 'src/auth/AuthService.ts',
    });
    expect(resPin.pinId).toBeDefined();

    // List pinned
    const pins = await harness.sessionManager.listPinnedContext(contextSessionId);
    expect(pins).toHaveLength(2);

    // Unpin
    const unpinned = await harness.sessionManager.unpinContext(contextSessionId, featPin.pinId);
    expect(unpinned).toBe(true);

    const remainingPins = await harness.sessionManager.listPinnedContext(contextSessionId);
    expect(remainingPins).toHaveLength(1);
    expect(remainingPins[0]?.targetId).toBe('src/auth/AuthService.ts');
  });

  it('rejects malicious or path traversal pins', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login timeout',
    });

    const contextSessionId = startResult.contextSession.contextSessionId;

    // Path traversal pin
    await expect(
      harness.sessionManager.pinContext(contextSessionId, {
        type: 'RESOURCE',
        targetId: '../../../../etc/passwd',
      })
    ).rejects.toThrow(ContextPinError);

    // Empty target
    await expect(
      harness.sessionManager.pinContext(contextSessionId, {
        type: 'FEATURE',
        targetId: '   ',
      })
    ).rejects.toThrow(ContextPinError);
  });
});
