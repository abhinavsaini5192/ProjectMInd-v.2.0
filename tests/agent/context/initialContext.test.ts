import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';

describe('Initial Context Generation', () => {
  it('resolves relevant features, resources, and obeys token budget', async () => {
    const harness = createContextHarness();
    const result = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login request timeout in auth module',
      tokenBudget: 4000,
      compactMode: false,
    });

    expect(result.contextPackage).toBeDefined();
    expect(result.contextPackage.features.length).toBeGreaterThan(0);
    expect(result.contextPackage.resources.length).toBeGreaterThan(0);
    expect(result.freshness).toBe('CURRENT');
    expect(result.versionMetadata.contextVersion).toBe(1);

    const featureNames = result.contextPackage.features.map((f) => f.name);
    expect(featureNames).toContain('Authentication');

    const resourcePaths = result.contextPackage.resources.map((r) => r.path);
    expect(resourcePaths).toContain('src/auth/AuthService.ts');
  });

  it('stores context state with selected features and resources', async () => {
    const harness = createContextHarness();
    const result = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Session token expiration inspection',
      featureIds: ['feat-session'],
    });

    const state = await harness.sessionManager.getContextState(
      result.contextSession.contextSessionId
    );

    expect(state).toBeDefined();
    expect(state?.contextVersion).toBe(1);
    expect(state?.freshness).toBe('CURRENT');
    expect(state?.selectedFeatures).toContain('feat-session');
  });

  it('provides compact context metadata without duplicating repository code', async () => {
    const harness = createContextHarness();
    const result = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'High level architectural inspection',
      compactMode: true,
    });

    expect(result.contextPackage.estimatedTokens).toBeLessThanOrEqual(8000);
    expect(result.contextPackage.freshness.status).toBe('CURRENT');
  });
});
