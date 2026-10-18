import { describe, it, expect } from 'vitest';
import { KnowledgeUpdateExplainer } from '../../../src/knowledge/update/core/KnowledgeUpdateExplainer.js';
import type { KnowledgeUpdate } from '../../../src/knowledge/update/models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../../../src/knowledge/update/models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../../../src/knowledge/update/models/KnowledgeUpdateResult.js';

describe('KnowledgeUpdateExplainer', () => {
  const explainer = new KnowledgeUpdateExplainer();

  const update: KnowledgeUpdate = {
    updateId: 'upd-exp-1',
    repositoryId: 'repo-mind',
    source: 'EXECUTION_OBSERVATION',
    provenance: 'SYSTEM_OBSERVED',
    updateType: 'RESOURCE_CHANGED',
    status: 'APPLIED',
    affectedResources: ['src/auth/login.ts'],
    affectedFeatures: ['feat-auth'],
    affectedKnowledgeAreas: ['FEATURE_MAPPING', 'FEATURE_HEALTH'],
    evidenceReferences: [],
    requestedAt: 1000,
    observedAt: 1000,
    idempotencyKey: 'k-exp-1',
    confidence: 0.95,
    retryCount: 0,
    metadata: {},
  };

  it('generates a human-readable explanation of an update alone', () => {
    const text = explainer.explain(update);
    expect(text).toContain('upd-exp-1');
    expect(text).toContain('EXECUTION_OBSERVATION');
    expect(text).toContain('SYSTEM_OBSERVED');
    expect(text).toContain('repo-mind');
    expect(text).toContain('src/auth/login.ts');
  });

  it('generates explanation including plan details', () => {
    const plan: KnowledgeUpdatePlan = {
      planId: 'plan-exp-1',
      updateId: 'upd-exp-1',
      targetResources: ['src/auth/login.ts'],
      targetFeatures: ['feat-auth'],
      targetKnowledgeAreas: ['FEATURE_MAPPING'],
      operations: [
        {
          operationId: 'op-1',
          area: 'FEATURE_MAPPING',
          action: 'MAP',
          targetId: 'feat-auth',
          dependencies: [],
        },
      ],
      invalidationTargets: ['feat-auth'],
      refreshTargets: [],
      confidence: 0.95,
      warnings: [],
      conflicts: [],
      skippedAreas: [],
      reasonCodes: [],
      createdAt: 1050,
    };

    const text = explainer.explain(update, plan);
    expect(text).toContain('Planned feature targets: [feat-auth]');
    expect(text).toContain('Planned operations count: 1');
  });

  it('generates rich explanation including execution results, version advancement, invalidations, and conflicts', () => {
    const result: KnowledgeUpdateResult = {
      updateId: 'upd-exp-1',
      status: 'APPLIED',
      success: true,
      partialSuccess: false,
      failure: false,
      appliedAreas: ['FEATURE_MAPPING'],
      failedAreas: [],
      skippedAreas: [],
      affectedResources: ['src/auth/login.ts'],
      affectedFeatures: ['feat-auth'],
      previousKnowledgeVersion: 'v1.0.0',
      newKnowledgeVersion: 'v1.0.1',
      invalidations: [
        {
          invalidationId: 'inv-1',
          updateId: 'upd-exp-1',
          repositoryId: 'repo-mind',
          targetType: 'FEATURE',
          targetId: 'feat-auth',
          reason: 'File changed',
          invalidatedAt: 1100,
        },
      ],
      refreshDecisions: [
        {
          decisionId: 'dec-1',
          updateId: 'upd-exp-1',
          policy: 'REFRESH_CURRENT_SESSION',
          targetSessionId: 'sess-1',
          affectedFeatures: ['feat-auth'],
          affectedResources: ['src/auth/login.ts'],
          reason: 'Session context refreshed',
          decidedAt: 1110,
        },
      ],
      conflicts: [],
      warnings: [],
      errors: [],
      retryEligible: false,
      processedAt: 1120,
      metadata: {},
    };

    const text = explainer.explain(update, undefined, result);
    expect(text).toContain('Applied knowledge areas: [FEATURE_MAPPING]');
    expect(text).toContain('Knowledge version advanced from v1.0.0 to v1.0.1');
    expect(text).toContain('Invalidations issued for: [FEATURE:feat-auth]');
    expect(text).toContain('Context refresh policy: [REFRESH_CURRENT_SESSION]');
  });
});
