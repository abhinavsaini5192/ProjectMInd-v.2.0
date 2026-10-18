import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOrchestrator, AUTH_FEATURE_ID } from './ContextTestHelper.js';
import type { ContextOrchestrator } from '../../src/context/orchestrator/ContextOrchestrator.js';

describe('Context Freshness Handling', () => {
  let orchestrator: ContextOrchestrator;

  beforeEach(() => {
    orchestrator = createTestOrchestrator();
  });

  it('re-evaluates fresh context when freshnessPolicy is CURRENT', async () => {
    const res1 = await orchestrator.orchestrateContext({
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      freshnessPolicy: 'CURRENT',
    });

    const res2 = await orchestrator.orchestrateContext({
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      freshnessPolicy: 'CURRENT',
    });

    expect(res1.cached).toBe(false);
    expect(res2.cached).toBe(false);
  });

  it('serves from cache when freshnessPolicy is ALLOW_STALE', async () => {
    const res1 = await orchestrator.orchestrateContext({
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      freshnessPolicy: 'ALLOW_STALE',
    });

    const res2 = await orchestrator.orchestrateContext({
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      freshnessPolicy: 'ALLOW_STALE',
    });

    expect(res1.cached).toBe(false);
    expect(res2.cached).toBe(true);
  });
});
