import { describe, it, expect } from 'vitest';
import { createSyntheticAuthenticationScenario } from './ApiTestHelper.js';

describe('Phase 6.9 - Section Retrieval and Convenience Methods', () => {
  const { api } = createSyntheticAuthenticationScenario();

  it('should retrieve identity only when requested', async () => {
    const res = await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY'],
    });

    expect(res.success).toBe(true);
    expect(res.profile.identity.status).toBe('AVAILABLE');
    expect(res.profile.identity.data?.name).toBe('Authentication');
    expect(res.profile.mappings.status).toBe('NOT_REQUESTED');
    expect(res.profile.behavior.status).toBe('NOT_REQUESTED');
    expect(res.profile.health.status).toBe('NOT_REQUESTED');
  });

  it('should retrieve mappings section via convenience method', async () => {
    const mappingsSection = await api.getFeatureMappings('feat_auth');
    expect(mappingsSection.status).toBe('AVAILABLE');
    expect(mappingsSection.data?.mappings.length).toBe(6);
    expect(mappingsSection.data?.primaryResources).toContain('POST /login');
    expect(mappingsSection.data?.primaryResources).toContain('AuthController.login');
  });

  it('should retrieve dependencies and dependents', async () => {
    const depSection = await api.getFeatureDependencies('feat_auth');
    expect(depSection.status).toBe('AVAILABLE');
    expect(depSection.data?.dependencies.length).toBe(1);
    expect(depSection.data?.dependencies[0]?.featureId).toBe('feat_user_mgmt');
    expect(depSection.data?.dependents.length).toBe(1);
    expect(depSection.data?.dependents[0]?.featureId).toBe('feat_checkout');
  });

  it('should retrieve behavior section', async () => {
    const behaviorSection = await api.getFeatureBehavior('feat_auth');
    expect(behaviorSection.status).toBe('AVAILABLE');
    expect(behaviorSection.data?.entryPoints).toContain('POST /login');
    expect(behaviorSection.data?.primaryFlows.length).toBe(1);
  });

  it('should retrieve health section and risks', async () => {
    const healthSection = await api.getFeatureHealth('feat_auth');
    expect(healthSection.status).toBe('AVAILABLE');
    expect(healthSection.data?.healthScore).toBe(88);
    expect(healthSection.data?.risks.length).toBe(1);
    expect(healthSection.data?.risks[0]?.description).toBe('missing OAuth failure verification');
  });

  it('should retrieve impact section', async () => {
    const impactSection = await api.getFeatureImpact('feat_auth');
    expect(impactSection.status).toBe('AVAILABLE');
    expect(impactSection.data?.impactedFeatures.length).toBe(1);
    expect(impactSection.data?.impactedFeatures[0]?.targetId).toBe('feat_checkout');
  });

  it('should retrieve history section', async () => {
    const historySection = await api.getFeatureHistory('feat_auth');
    expect(historySection.status).toBe('AVAILABLE');
    expect(historySection.data?.milestones.length).toBe(4);
    expect(historySection.data?.milestones.map((m) => m.title)).toContain('feature created');
  });

  it('should retrieve summary data', async () => {
    const summary = await api.getFeatureSummary('feat_auth');
    expect(summary.featureId).toBe('feat_auth');
    expect(summary.name).toBe('Authentication');
    expect(summary.mappedResourceCount).toBe(6);
    expect(summary.dependencyCount).toBe(1);
    expect(summary.dependentCount).toBe(1);
    expect(summary.healthScore).toBe(88);
  });
});
