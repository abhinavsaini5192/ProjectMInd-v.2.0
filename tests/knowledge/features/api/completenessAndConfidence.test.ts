import { describe, it, expect } from 'vitest';
import { createSyntheticAuthenticationScenario } from './ApiTestHelper.js';
import { FeatureKnowledgePlanner } from '../../../../src/knowledge/features/api/core/FeatureKnowledgePlanner.js';
import { FeatureKnowledgeFreshnessResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeFreshnessResolver.js';
import { FeatureKnowledgeExplainer } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeExplainer.js';
import { FeatureKnowledgeResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeResolver.js';
import { FeatureKnowledgeAssembler } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAssembler.js';
import { FeatureKnowledgeQueryService } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeQueryService.js';
import { FeatureKnowledgeAPI } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAPI.js';
import { createMockFeatureRepository, createMockMappingRepository } from './ApiTestHelper.js';

describe('Phase 6.9 - Completeness and Confidence Models', () => {
  it('should calculate COMPLETE status when all requested sections are available', async () => {
    const { api } = createSyntheticAuthenticationScenario();
    const res = await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS', 'DEPENDENCIES'],
    });

    expect(res.profile.completeness.status).toBe('COMPLETE');
    expect(res.profile.completeness.completenessRatio).toBe(1);
    expect(res.profile.completeness.availableSections.length).toBe(3);
    expect(res.profile.completeness.failedSections.length).toBe(0);
  });

  it('should calculate PARTIAL status and record missing reasons when providers are not computed', async () => {
    const feature = { id: 'feat_minimal', name: 'Minimal', description: 'test' };
    const featureRepo = createMockFeatureRepository([feature]);
    const mappingRepo = createMockMappingRepository({ feat_minimal: [] });

    // Only mapping is provided, other sections (behavior, health, history) will be NOT_COMPUTED
    const resolver = new FeatureKnowledgeResolver({
      featureRepository: featureRepo,
      mappingRepository: mappingRepo,
    });

    const queryService = new FeatureKnowledgeQueryService({
      planner: new FeatureKnowledgePlanner(),
      resolver,
      freshnessResolver: new FeatureKnowledgeFreshnessResolver(),
      explainer: new FeatureKnowledgeExplainer(),
      assembler: new FeatureKnowledgeAssembler(),
    });
    const api = new FeatureKnowledgeAPI(queryService);

    const res = await api.getFeatureKnowledge({
      featureId: 'feat_minimal',
      sections: ['IDENTITY', 'MAPPINGS', 'BEHAVIOR', 'HEALTH', 'HISTORY'],
    });

    expect(res.profile.completeness.completenessRatio).toBeLessThan(1);
    expect(res.profile.completeness.notComputedSections).toContain('BEHAVIOR');
    expect(res.profile.completeness.notComputedSections).toContain('HEALTH');
    expect(res.profile.completeness.notComputedSections).toContain('HISTORY');
    expect(res.profile.completeness.missingKnowledgeReasons['BEHAVIOR']).toBeDefined();
  });

  it('should track confidence per section without simplistic averaging hiding weak evidence', async () => {
    const { api } = createSyntheticAuthenticationScenario();
    const res = await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS', 'DEPENDENCIES', 'HEALTH'],
    });

    const conf = res.profile.confidence;
    expect(conf.overallScore).toBeGreaterThan(0.8);
    expect(conf.level).toBe('VERY_HIGH');
    expect(conf.sectionConfidences['identity']).toBe(1.0);
    expect(conf.sectionConfidences['health']).toBe(0.95);
    expect(conf.factors.length).toBeGreaterThan(0);
  });
});
