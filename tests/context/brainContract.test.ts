import { describe, it, expect } from 'vitest';
import { createTestOrchestrator, AUTH_FEATURE_ID } from './ContextTestHelper.js';
import { ContextProvider } from '../../src/context/provider/ContextProvider.js';

describe('Brain Integration Contract (ContextProvider)', () => {
  const orchestrator = createTestOrchestrator();
  const provider = new ContextProvider(orchestrator);

  it('getContextForTask returns canonical ContextPackage for string or request', async () => {
    const pkg = await provider.getContextForTask('Improve authentication flow');
    expect(pkg).toBeDefined();
    expect(pkg.packageId).toBeDefined();
    expect(pkg.features.some((f) => f.featureId === AUTH_FEATURE_ID)).toBe(true);
  });

  it('getContextForFeature returns context package for a specific feature ID', async () => {
    const pkg = await provider.getContextForFeature(AUTH_FEATURE_ID);
    expect(pkg).toBeDefined();
    expect(pkg.features[0]!.featureId).toBe(AUTH_FEATURE_ID);
    expect(pkg.resources.length).toBeGreaterThan(0);
  });

  it('getContextForChange returns context package for a modified resource', async () => {
    const pkg = await provider.getContextForChange({
      resourceId: 'src/auth/AuthService.ts',
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
    });

    expect(pkg).toBeDefined();
    expect(pkg.features.some((f) => f.featureId === AUTH_FEATURE_ID)).toBe(true);
  });

  it('getContextForResources returns context package for specified resources', async () => {
    const pkg = await provider.getContextForResources(
      ['src/auth/AuthService.ts'],
      'repo-mind',
      'ws-mind'
    );

    expect(pkg).toBeDefined();
    expect(pkg.resources.length).toBeGreaterThan(0);
  });
});
