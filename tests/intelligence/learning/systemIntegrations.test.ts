import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryLearningStore } from '../../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { LearningPolicyEngine } from '../../../src/intelligence/learning/services/LearningPolicyEngine.js';
import { LearningDeploymentManager } from '../../../src/intelligence/learning/services/LearningDeploymentManager.js';
import { ContextLearningAdapter } from '../../../src/intelligence/learning/integrations/ContextLearningAdapter.js';
import { RetrievalLearningAdapter } from '../../../src/intelligence/learning/integrations/RetrievalLearningAdapter.js';
import { PlanningLearningAdapter } from '../../../src/intelligence/learning/integrations/PlanningLearningAdapter.js';
import { CollaborationLearningAdapter } from '../../../src/intelligence/learning/integrations/CollaborationLearningAdapter.js';
import { MemoryLearningAdapter } from '../../../src/intelligence/learning/integrations/MemoryLearningAdapter.js';
import { FeatureLearningAdapter } from '../../../src/intelligence/learning/integrations/FeatureLearningAdapter.js';
import type { ContextCandidate, RelevanceDimensions } from '../../../src/context/models/ContextCandidate.js';
import type { RetrievalResult, RetrievalDimensions } from '../../../src/retrieval/models/RetrievalResult.js';
import type { TaskPlanNode } from '../../../src/agent/planning/models/TaskPlanNode.js';

describe('System Integrations (Phase 9.3, 9.4, 9.5, 9.6)', () => {
  let store: InMemoryLearningStore;
  let policyEngine: LearningPolicyEngine;
  let deploymentManager: LearningDeploymentManager;

  beforeEach(() => {
    store = new InMemoryLearningStore();
    policyEngine = new LearningPolicyEngine();
    deploymentManager = new LearningDeploymentManager(store, policyEngine);
  });

  it('should adjust context candidate relevance scores via ContextLearningAdapter', async () => {
    // Deploy a context adaptation
    await store.saveDeployed({
      id: 'dep_ctx_1',
      candidateId: 'cand_1',
      version: 1,
      target: { system: 'CONTEXT', targetType: 'RESOURCE', targetId: 'src/auth/jwt.ts' },
      appliedChange: { resourceId: 'src/auth/jwt.ts', weightAdjustment: 0.20, mandatoryInclude: true },
      scope: { level: 'PROJECT', value: 'proj_1', workspaceId: 'ws_1', projectId: 'proj_1' },
      deployedAt: Date.now(),
      deployedBy: 'admin',
      status: 'ACTIVE',
      evaluationId: 'eval_1',
    });

    const adapter = new ContextLearningAdapter(deploymentManager);
    const defaultDimensions: RelevanceDimensions = {
      taskRelevance: 0.9,
      featureRelevance: 1.0,
      architecturalRelevance: 0.8,
      dependencyRelevance: 0.8,
      behavioralRelevance: 0.8,
      changeRelevance: 0.5,
      historyRelevance: 0.5,
      riskRelevance: 0.2,
      verificationRelevance: 0.8,
      recency: 1.0,
      confidence: 0.95,
      scopeRelevance: 1.0,
    };
    const mockCandidates: ContextCandidate[] = [
      {
        candidateId: 'cand_res_1',
        id: 'cand_res_1',
        candidateType: 'FILE',
        name: 'jwt.ts',
        path: 'src/auth/jwt.ts',
        type: 'FILE',
        score: 0.70,
        priority: 'MEDIUM',
        primaryEvidence: 'lexical match',
        isMandatory: false,
        estimatedTokens: 150,
        sizeTokens: 150,
        dimensions: defaultDimensions,
      },
      {
        candidateId: 'cand_res_2',
        id: 'cand_res_2',
        candidateType: 'FILE',
        name: 'billing.ts',
        path: 'src/billing/billing.ts',
        type: 'FILE',
        score: 0.65,
        priority: 'LOW',
        primaryEvidence: 'minor match',
        isMandatory: false,
        estimatedTokens: 100,
        sizeTokens: 100,
        dimensions: defaultDimensions,
      },
    ];

    const adjusted = await adapter.applyLearnedAdjustments(mockCandidates, 'ws_1', 'proj_1');
    expect(adjusted[0]!.score).toBe(0.90);
    expect(adjusted[0]!.isMandatory).toBe(true);
    expect(adjusted[0]!.primaryEvidence).toContain('Learned weight adjustment');
    expect(adjusted[1]!.score).toBe(0.65); // Untouched
  });

  it('should reorder retrieval ranking via RetrievalLearningAdapter', async () => {
    // Deploy retrieval ranking adjustment for resource A (+0.25)
    await store.saveDeployed({
      id: 'dep_ret_1',
      candidateId: 'cand_ret',
      version: 1,
      target: { system: 'RETRIEVAL', targetType: 'RESOURCE', targetId: 'res_auth_helper' },
      appliedChange: { resourceId: 'res_auth_helper', rankingScoreDelta: 0.25 },
      scope: { level: 'PROJECT', value: 'proj_1', workspaceId: 'ws_1', projectId: 'proj_1' },
      deployedAt: Date.now(),
      deployedBy: 'admin',
      status: 'ACTIVE',
      evaluationId: 'eval_ret',
    });

    const adapter = new RetrievalLearningAdapter(deploymentManager);
    const defaultRetrievalDimensions: RetrievalDimensions = {
      lexicalRelevance: 0.8,
      semanticRelevance: 0.8,
      featureRelevance: 0.8,
      graphRelevance: 0.8,
      taskRelevance: 0.8,
      recency: 1.0,
      confidence: 0.9,
      sourceAuthority: 0.8,
      scopeRelevance: 1.0,
      verificationRelevance: 0.8,
    };
    const candidates: RetrievalResult[] = [
      {
        candidateId: 'ret_1',
        resourceId: 'res_other',
        resourceType: 'FILE',
        name: 'other.ts',
        source: 'TEXT_INDEX',
        authority: 'DERIVED_INTELLIGENCE',
        score: 0.80,
        confidence: 0.9,
        evidence: ['other.ts'],
        dimensions: defaultRetrievalDimensions,
      },
      {
        candidateId: 'ret_2',
        resourceId: 'res_auth_helper',
        resourceType: 'FILE',
        name: 'auth_helper.ts',
        source: 'TEXT_INDEX',
        authority: 'STRUCTURED_REPOSITORY_FACTS',
        score: 0.65,
        confidence: 0.9,
        evidence: ['auth_helper.ts'],
        dimensions: defaultRetrievalDimensions,
      },
    ];

    const reordered = await adapter.applyLearnedRanking(candidates, 'ws_1', 'proj_1');
    // res_auth_helper score becomes 0.65 + 0.25 = 0.90, jumping to first position
    expect(reordered[0]!.resourceId).toBe('res_auth_helper');
    expect(reordered[0]!.score).toBe(0.90);
    expect(reordered[1]!.resourceId).toBe('res_other');
  });

  it('should augment task plan with learned validation step via PlanningLearningAdapter', async () => {
    // Deploy planning heuristic for oauth tasks
    await store.saveDeployed({
      id: 'dep_plan_1',
      candidateId: 'cand_plan',
      version: 1,
      target: { system: 'PLANNING', targetType: 'TASK_TYPE', targetId: 'oauth' },
      appliedChange: {
        taskPattern: 'oauth',
        recommendation: 'ADD_VALIDATION_STEP',
        recommendedStep: {
          title: 'Verify OAuth Redirect Callbacks',
          taskType: 'VERIFICATION',
          priority: 9,
        },
      },
      scope: { level: 'PROJECT', value: 'proj_1', workspaceId: 'ws_1', projectId: 'proj_1' },
      deployedAt: Date.now(),
      deployedBy: 'admin',
      status: 'ACTIVE',
      evaluationId: 'eval_plan',
    });

    const adapter = new PlanningLearningAdapter(deploymentManager);
    const initialNodes: TaskPlanNode[] = [
      {
        id: 'node_1',
        planId: 'plan_1',
        taskId: 'task_oauth_1',
        title: 'Implement OAuth Handler',
        objective: 'Implement OAuth flow',
        taskType: 'IMPLEMENTATION',
        status: 'PENDING',
        priority: 8,
        dependencies: [],
        requiredCapabilities: [],
        affectedFeatures: [],
        affectedResources: [],
        risk: 'LOW',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const augmented = await adapter.augmentTaskNodes(
      initialNodes,
      'Deploy Google OAuth authentication',
      'ws_1',
      'proj_1'
    );

    expect(augmented).toHaveLength(2);
    expect(augmented[1]!.title).toBe('Verify OAuth Redirect Callbacks');
    expect(augmented[1]!.taskType).toBe('VERIFICATION');
    expect(augmented[1]!.dependencies[0]!.targetNodeId).toBe('node_1');
  });

  it('should adjust role affinities via CollaborationLearningAdapter', async () => {
    await store.saveDeployed({
      id: 'dep_col_1',
      candidateId: 'cand_col',
      version: 1,
      target: { system: 'COLLABORATION', targetType: 'AGENT_ROLE', targetId: 'REVIEWER' },
      appliedChange: { targetRoleOrCapability: 'REVIEWER', affinityModifier: 0.15 },
      scope: { level: 'PROJECT', value: 'proj_1', workspaceId: 'ws_1', projectId: 'proj_1' },
      deployedAt: Date.now(),
      deployedBy: 'admin',
      status: 'ACTIVE',
      evaluationId: 'eval_col',
    });

    const adapter = new CollaborationLearningAdapter(deploymentManager);
    const affinities = await adapter.getRoleAffinityAdjustments('ws_1', 'proj_1');

    expect(affinities.get('REVIEWER')).toBe(0.15);
  });

  it('should identify stale memories flagged for decay via MemoryLearningAdapter', async () => {
    await store.saveDeployed({
      id: 'dep_mem_1',
      candidateId: 'cand_mem',
      version: 1,
      target: { system: 'MEMORY', targetType: 'MEMORY_RECORD', targetId: 'mem_deprecated_arch' },
      appliedChange: { memoryId: 'mem_deprecated_arch', action: 'FLAG_FOR_DECAY' },
      scope: { level: 'PROJECT', value: 'proj_1', workspaceId: 'ws_1', projectId: 'proj_1' },
      deployedAt: Date.now(),
      deployedBy: 'admin',
      status: 'ACTIVE',
      evaluationId: 'eval_mem',
    });

    const adapter = new MemoryLearningAdapter(deploymentManager);
    const staleIds = await adapter.getStaleMemoryIds('ws_1', 'proj_1');

    expect(staleIds.has('mem_deprecated_arch')).toBe(true);
  });

  it('should provide feature-resource association boosts via FeatureLearningAdapter', async () => {
    await store.saveDeployed({
      id: 'dep_feat_1',
      candidateId: 'cand_feat',
      version: 1,
      target: { system: 'FEATURE', targetType: 'FEATURE', targetId: 'feat_auth' },
      appliedChange: { featureId: 'feat_auth', associationScoreDelta: 0.20 },
      scope: { level: 'PROJECT', value: 'proj_1', workspaceId: 'ws_1', projectId: 'proj_1' },
      deployedAt: Date.now(),
      deployedBy: 'admin',
      status: 'ACTIVE',
      evaluationId: 'eval_feat',
    });

    const adapter = new FeatureLearningAdapter(deploymentManager);
    const boosts = await adapter.getFeatureAssociationBoosts('ws_1', 'proj_1');

    expect(boosts.get('feat_auth')).toBe(0.20);
  });
});
