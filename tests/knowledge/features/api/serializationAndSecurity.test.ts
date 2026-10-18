import { describe, it, expect } from 'vitest';
import { createSyntheticAuthenticationScenario } from './ApiTestHelper.js';
import { FeatureKnowledgeSerializer } from '../../../../src/knowledge/features/api/serializers/FeatureKnowledgeSerializer.js';
import { FeatureKnowledgeResponseSerializer } from '../../../../src/knowledge/features/api/serializers/FeatureKnowledgeResponseSerializer.js';
import { FeatureKnowledgeAccessError } from '../../../../src/knowledge/features/api/errors/FeatureKnowledgeAccessError.js';

describe('Phase 6.9 - Serialization and Security Isolation', () => {
  const { api } = createSyntheticAuthenticationScenario();

  it('should serialize profile without circular references and in deterministic order', async () => {
    const res = await api.getFeatureKnowledge('feat_auth');
    const jsonStr = FeatureKnowledgeSerializer.serialize(res.profile);

    expect(typeof jsonStr).toBe('string');
    expect(() => JSON.parse(jsonStr)).not.toThrow();

    const parsed = FeatureKnowledgeSerializer.deserialize(jsonStr);
    expect(parsed.featureId).toBe('feat_auth');
    expect(parsed.identity.data?.name).toBe('Authentication');
  });

  it('should redact sensitive tokens and keys during serialization', () => {
    const sensitiveData = {
      apiKey: 'secret_12345',
      passwordHash: 'secret_hash',
      normalField: 'visible_data',
    };

    const sanitized = FeatureKnowledgeSerializer.sanitize(sensitiveData);
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.passwordHash).toBe('[REDACTED]');
    expect(sanitized.normalField).toBe('visible_data');
  });

  it('should serialize complete response with FeatureKnowledgeResponseSerializer', async () => {
    const res = await api.getFeatureKnowledge('feat_auth');
    const jsonStr = FeatureKnowledgeResponseSerializer.serialize(res);

    expect(typeof jsonStr).toBe('string');
    const parsed = FeatureKnowledgeResponseSerializer.deserialize(jsonStr);
    expect(parsed.success).toBe(true);
    expect(parsed.metadata.requestId).toBeDefined();
  });

  it('should reject cross-workspace access attempts', async () => {
    await expect(
      api.getFeatureKnowledge({
        featureId: 'feat_auth',
        workspaceId: 'forbidden_workspace_xyz',
      })
    ).rejects.toThrow(FeatureKnowledgeAccessError);
  });

  it('should reject cross-repository access attempts', async () => {
    await expect(
      api.getFeatureKnowledge({
        featureId: 'feat_auth',
        repositoryId: 'forbidden_repo_123',
      })
    ).rejects.toThrow(FeatureKnowledgeAccessError);
  });
});
