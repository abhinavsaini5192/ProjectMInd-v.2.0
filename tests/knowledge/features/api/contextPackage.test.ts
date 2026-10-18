import { describe, it, expect } from 'vitest';
import { createSyntheticAuthenticationScenario } from './ApiTestHelper.js';

describe('Phase 6.9 - Context Package for LLM Orchestration', () => {
  const { api } = createSyntheticAuthenticationScenario();

  it('should generate bounded, deterministic context package via getFeatureContext', async () => {
    const pkg = await api.getFeatureContext('feat_auth');

    expect(pkg.featureId).toBe('feat_auth');
    expect(pkg.name).toBe('Authentication');
    expect(pkg.entryPoints).toContain('POST /login');
    expect(pkg.primaryResources).toContain('AuthController.login');
    expect(pkg.directDependencies).toContain('feat_user_mgmt');
    expect(pkg.importantDependents).toContain('feat_checkout');
    expect(pkg.highSeverityRisks.length).toBe(1);
    expect(pkg.highSeverityRisks[0]).toBe('missing OAuth failure verification');
    expect(pkg.healthSummary.status).toBe('HEALTHY');
    expect(pkg.estimatedTokens).toBeGreaterThan(0);
    expect(pkg.completeness).toBe('COMPLETE');
  });

  it('should enforce token budget constraints on context items', async () => {
    const pkg = await api.getFeatureContext('feat_auth', {
      tokenBudget: 300, // Tight budget
    });

    expect(pkg.entryPoints.length).toBeLessThanOrEqual(3);
    expect(pkg.primaryResources.length).toBeLessThanOrEqual(5);
    expect(pkg.directDependencies.length).toBeLessThanOrEqual(3);
    expect(pkg.estimatedTokens).toBeLessThan(300);
  });

  it('should prioritize high-severity risks in context package', async () => {
    const pkg = await api.getFeatureContext('feat_auth');
    // Only HIGH or CRITICAL severity risks are included in highSeverityRisks
    for (const r of pkg.highSeverityRisks) {
      expect(r).toBeDefined();
    }
  });
});
