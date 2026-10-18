import { describe, it, expect } from 'vitest';
import { createContextHarness, createMockContextPackage } from './ContextTestHelper.js';
import { AgentContextDeltaCalculator } from '../../../src/agent/context/services/AgentContextDeltaCalculator.js';
import {
  ContextVersionConflictError,
  ContextDeltaInvalidError,
} from '../../../src/agent/context/errors/AgentContextError.js';

describe('Context Delta & Safety', () => {
  it('computes fine-grained deltas between context package versions', () => {
    const calculator = new AgentContextDeltaCalculator();
    const pkg1 = createMockContextPackage();
    const pkg2 = createMockContextPackage({
      features: [
        ...pkg1.features,
        {
          featureId: 'feat-user',
          name: 'User Management',
          description: 'User profiles',
          entryPoints: [],
          components: [],
          primaryRole: 'SERVICE',
        } as any,
      ],
      resources: [
        pkg1.resources[0]!,
        {
          resourceId: 'res-user-model',
          path: 'src/user/User.ts',
          tokenCount: 200,
          content: 'export class User {}',
          contentHash: 'hash_user_1',
        } as any,
      ],
    });

    const delta = calculator.computeDelta(
      pkg1,
      pkg2,
      'TASK_CHANGED',
      'cs-test-1',
      1,
      2
    );

    expect(delta.baseContextVersion).toBe(1);
    expect(delta.targetContextVersion).toBe(2);

    // Feature feat-user was added
    const addedFeatures = delta.added.filter((i) => i.type === 'FEATURE');
    expect(addedFeatures).toHaveLength(1);
    expect(addedFeatures[0]?.id).toBe('feat-user');

    // Resources added and removed
    const addedResources = delta.added.filter((i) => i.type === 'RESOURCE');
    expect(addedResources).toHaveLength(1);
    expect(addedResources[0]?.id).toBe('res-user-model');

    const removedResources = delta.removed.filter((i) => i.type === 'RESOURCE');
    expect(removedResources.length).toBeGreaterThan(0);
  });

  it('validates delta safety and detects version conflicts', () => {
    const calculator = new AgentContextDeltaCalculator();
    const pkg1 = createMockContextPackage();
    const pkg2 = createMockContextPackage();

    const delta = calculator.computeDelta(pkg1, pkg2, 'RESOURCE_CHANGED', 'cs-1', 1, 2);

    // Passing valid current version 1 -> no throw
    expect(() => {
      calculator.validateDeltaSafety(delta, 1, 'repo-test', 'repo-test');
    }).not.toThrow();

    // Passing mismatched base version (e.g. current is already 2) -> ContextVersionConflictError
    expect(() => {
      calculator.validateDeltaSafety(delta, 2, 'repo-test', 'repo-test');
    }).toThrow(ContextVersionConflictError);

    // Repository mismatch -> ContextDeltaInvalidError
    expect(() => {
      calculator.validateDeltaSafety(delta, 1, 'repo-different', 'repo-test');
    }).toThrow(ContextDeltaInvalidError);
  });

  it('returns context delta when requested via getCurrentContext', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login timeout',
    });

    // Perform refresh to version 2
    await harness.sessionManager.refreshContextSession(
      startResult.contextSession.contextSessionId,
      {
        reason: 'RESOURCE_CHANGED',
        modifiedFiles: ['src/auth/AuthService.ts'],
      }
    );

    // Request current context with includeDelta: true
    const currentResult = await harness.sessionManager.getCurrentContext(
      startResult.contextSession.contextSessionId,
      {
        includeDelta: true,
        baseContextVersion: 1,
      }
    );

    expect(currentResult.contextVersion).toBe(2);
    expect(currentResult.delta).toBeDefined();
    expect(currentResult.delta?.baseContextVersion).toBe(1);
    expect(currentResult.delta?.targetContextVersion).toBe(2);
  });
});
