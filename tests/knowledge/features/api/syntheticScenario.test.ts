import { describe, it, expect, vi } from 'vitest';
import { createSyntheticAuthenticationScenario } from './ApiTestHelper.js';

describe('Phase 6.9 - Section 30 Synthetic Authentication Scenario', () => {
  it('should return a coherent unified profile across all subsystems for getFeatureKnowledge(Authentication)', async () => {
    const { api } = createSyntheticAuthenticationScenario();

    const response = await api.getFeatureKnowledge('feat_auth');

    expect(response.success).toBe(true);
    expect(response.errors).toBeUndefined();

    // 1. Identity validation
    expect(response.profile.identity.status).toBe('AVAILABLE');
    expect(response.profile.identity.data?.id).toBe('feat_auth');
    expect(response.profile.identity.data?.name).toBe('Authentication');
    expect(response.profile.identity.data?.type).toBe('USER_FACING');
    expect(response.profile.identity.data?.status).toBe('ACTIVE');

    // 2. Mappings validation
    expect(response.profile.mappings.status).toBe('AVAILABLE');
    expect(response.profile.mappings.itemCount).toBe(6);
    const mappedResourceIds = response.profile.mappings.data?.mappings.map((m) => m.resourceId);
    expect(mappedResourceIds).toContain('POST /login');
    expect(mappedResourceIds).toContain('AuthController.login');
    expect(mappedResourceIds).toContain('AuthService.login');
    expect(mappedResourceIds).toContain('UserRepository.findByEmail');
    expect(mappedResourceIds).toContain('TokenService.generate');
    expect(mappedResourceIds).toContain('authentication tests');

    // 3. Dependencies validation
    expect(response.profile.dependencies.status).toBe('AVAILABLE');
    const outgoingIds = response.profile.dependencies.data?.dependencies.map((d) => d.featureId);
    expect(outgoingIds).toContain('feat_user_mgmt');
    const incomingIds = response.profile.dependencies.data?.dependents.map((d) => d.featureId);
    expect(incomingIds).toContain('feat_checkout');

    // 4. Behavior validation
    expect(response.profile.behavior.status).toBe('AVAILABLE');
    expect(response.profile.behavior.data?.entryPoints).toContain('POST /login');
    const flow = response.profile.behavior.data?.primaryFlows[0];
    expect(flow?.name).toContain('AuthController.login');
    expect(flow?.name).toContain('TokenService.generate');

    // 5. Health & Risks validation
    expect(response.profile.health.status).toBe('AVAILABLE');
    expect(response.profile.health.data?.verificationQuality).toBe('HIGH');
    expect(response.profile.health.data?.risks.length).toBe(1);
    expect(response.profile.health.data?.risks[0]?.description).toBe(
      'missing OAuth failure verification'
    );

    // 6. History validation
    expect(response.profile.history.status).toBe('AVAILABLE');
    const milestoneTitles = response.profile.history.data?.milestones.map((m) => m.title);
    expect(milestoneTitles).toContain('feature created');
    expect(milestoneTitles).toContain('login endpoint added');
    expect(milestoneTitles).toContain('token refresh flow added');
    expect(milestoneTitles).toContain('health improved');

    // 7. Metadata validation
    expect(response.metadata.freshness.status).toBe('CURRENT');
    expect(response.metadata.versionStatus.consistencyStatus).toBe('CONSISTENT');

    // 8. Completeness and Confidence validation
    expect(response.profile.completeness.status).toBe('COMPLETE');
    expect(response.profile.confidence.level).toBe('VERY_HIGH');
  });

  it('must not call behavior, health, impact, or history providers on selective query [IDENTITY, MAPPINGS]', async () => {
    const scenario = createSyntheticAuthenticationScenario();

    const behaviorSpy = vi.spyOn(scenario.repos.behaviorRepo, 'getBehavior');
    const healthSpy = vi.spyOn(scenario.repos.healthRepo, 'getByFeatureId');
    const impactSpy = vi.spyOn(scenario.repos.impactRepo, 'getFeatureImpacts');
    const historySpy = vi.spyOn(scenario.repos.historyRepo, 'getHistory');

    const res = await scenario.api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS'],
    });

    expect(res.profile.identity.status).toBe('AVAILABLE');
    expect(res.profile.mappings.status).toBe('AVAILABLE');

    // Verify unrequested sections were not called:
    expect(behaviorSpy).not.toHaveBeenCalled();
    expect(healthSpy).not.toHaveBeenCalled();
    expect(impactSpy).not.toHaveBeenCalled();
    expect(historySpy).not.toHaveBeenCalled();

    expect(res.profile.behavior.status).toBe('NOT_REQUESTED');
    expect(res.profile.health.status).toBe('NOT_REQUESTED');
    expect(res.profile.impact.status).toBe('NOT_REQUESTED');
    expect(res.profile.history.status).toBe('NOT_REQUESTED');
  });
});
