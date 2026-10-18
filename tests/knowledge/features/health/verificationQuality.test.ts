import { describe, it, expect } from 'vitest';
import { HealthTestHelper } from './HealthTestHelper.js';
import { FeatureHealthScorer } from '../../../../src/knowledge/features/health/core/FeatureHealthScorer.js';

describe('Phase 6.6 Verification Quality Assessment', () => {
  const scorer = new FeatureHealthScorer();

  it('evaluates COMPREHENSIVE verification when unit, integration, and E2E tests exist with verified flows', () => {
    const feature = HealthTestHelper.createFeature('feat_tested', 'Well-Tested Feature');
    const codeMap = HealthTestHelper.createMapping('feat_tested', 'src/service.ts', 'FILE');
    const unitTest = HealthTestHelper.createMapping('feat_tested', 'tests/service.unit.test.ts', 'FILE', 'TEST');
    const intTest = HealthTestHelper.createMapping('feat_tested', 'tests/service.integration.test.ts', 'FILE', 'TEST');
    const e2eTest = HealthTestHelper.createMapping('feat_tested', 'tests/service.e2e.test.ts', 'FILE', 'TEST');

    const flow = HealthTestHelper.createFlow('feat_tested', 'flow_1', 'Main Flow', 'PRIMARY', 4, {
      isVerified: true
    });

    const ctx = HealthTestHelper.createContext({
      feature,
      mappings: [codeMap, unitTest, intTest, e2eTest],
      flows: [flow]
    });

    const verif = scorer.calculateVerificationQuality(ctx, []);
    expect(verif.level).toBe('COMPREHENSIVE');
    expect(verif.hasUnitTests).toBe(true);
    expect(verif.hasIntegrationTests).toBe(true);
    expect(verif.hasE2ETests).toBe(true);
    expect(verif.verifiedFlowCount).toBe(1);
    expect(verif.unverifiedFlowCount).toBe(0);
    expect(verif.score).toBeGreaterThanOrEqual(80);
  });

  it('evaluates NONE verification when no tests exist', () => {
    const feature = HealthTestHelper.createFeature('feat_untested', 'Untested Feature');
    const codeMap1 = HealthTestHelper.createMapping('feat_untested', 'src/a.ts', 'FILE');
    const codeMap2 = HealthTestHelper.createMapping('feat_untested', 'src/b.ts', 'FILE');

    const ctx = HealthTestHelper.createContext({
      feature,
      mappings: [codeMap1, codeMap2]
    });

    const verif = scorer.calculateVerificationQuality(ctx, []);
    expect(verif.level).toBe('NONE');
    expect(verif.testFileCount).toBe(0);
    expect(verif.score).toBe(0);
  });
});
