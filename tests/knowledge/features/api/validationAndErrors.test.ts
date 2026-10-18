import { describe, it, expect } from 'vitest';
import { FeatureKnowledgeValidator } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeValidator.js';
import { FeatureKnowledgeQueryError } from '../../../../src/knowledge/features/api/errors/FeatureKnowledgeQueryError.js';
import { FeatureKnowledgeNotFoundError } from '../../../../src/knowledge/features/api/errors/FeatureKnowledgeNotFoundError.js';
import { FeatureKnowledgeAccessError } from '../../../../src/knowledge/features/api/errors/FeatureKnowledgeAccessError.js';
import { createSyntheticAuthenticationScenario } from './ApiTestHelper.js';

describe('Phase 6.9 - Query Validation and Error Handling', () => {
  it('should accept valid query', () => {
    expect(() => {
      FeatureKnowledgeValidator.validate({
        featureId: 'feat_auth',
        sections: ['IDENTITY', 'MAPPINGS'],
        maxDepth: 3,
        tokenBudget: 1000,
        freshness: 'CURRENT',
      });
    }).not.toThrow();
  });

  it('should throw if featureId is missing or empty', () => {
    expect(() => {
      FeatureKnowledgeValidator.validate({ featureId: '' });
    }).toThrow(FeatureKnowledgeQueryError);

    expect(() => {
      FeatureKnowledgeValidator.validate({ featureId: '   ' });
    }).toThrow(FeatureKnowledgeQueryError);

    expect(() => {
      FeatureKnowledgeValidator.validate({} as any);
    }).toThrow(FeatureKnowledgeQueryError);
  });

  it('should throw if section is invalid', () => {
    expect(() => {
      FeatureKnowledgeValidator.validate({
        featureId: 'feat_auth',
        sections: ['IDENTITY', 'NON_EXISTENT_SECTION' as any],
      });
    }).toThrow(FeatureKnowledgeQueryError);
  });

  it('should throw if maxDepth is invalid', () => {
    expect(() => {
      FeatureKnowledgeValidator.validate({
        featureId: 'feat_auth',
        maxDepth: -1,
      });
    }).toThrow(FeatureKnowledgeQueryError);

    expect(() => {
      FeatureKnowledgeValidator.validate({
        featureId: 'feat_auth',
        maxDepth: 2.5,
      });
    }).toThrow(FeatureKnowledgeQueryError);
  });

  it('should throw if tokenBudget is non-positive', () => {
    expect(() => {
      FeatureKnowledgeValidator.validate({
        featureId: 'feat_auth',
        tokenBudget: 0,
      });
    }).toThrow(FeatureKnowledgeQueryError);
  });

  it('should throw if freshness policy is invalid', () => {
    expect(() => {
      FeatureKnowledgeValidator.validate({
        featureId: 'feat_auth',
        freshness: 'INVALID_FRESHNESS' as any,
      });
    }).toThrow(FeatureKnowledgeQueryError);
  });

  it('should throw FeatureKnowledgeNotFoundError when feature does not exist', async () => {
    const { api } = createSyntheticAuthenticationScenario();
    await expect(api.getFeatureKnowledge('non_existent_feature')).rejects.toThrow(
      FeatureKnowledgeNotFoundError
    );
  });

  it('should throw FeatureKnowledgeAccessError on workspace mismatch', async () => {
    const { api } = createSyntheticAuthenticationScenario();
    await expect(
      api.getFeatureKnowledge({
        featureId: 'feat_auth',
        workspaceId: 'different_workspace',
      })
    ).rejects.toThrow(FeatureKnowledgeAccessError);
  });

  it('should throw FeatureKnowledgeAccessError on repository mismatch', async () => {
    const { api } = createSyntheticAuthenticationScenario();
    await expect(
      api.getFeatureKnowledge({
        featureId: 'feat_auth',
        repositoryId: 'different_repo',
      })
    ).rejects.toThrow(FeatureKnowledgeAccessError);
  });
});
