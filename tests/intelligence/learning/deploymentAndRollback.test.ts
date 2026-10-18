import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryLearningStore } from '../../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { LearningPolicyEngine } from '../../../src/intelligence/learning/services/LearningPolicyEngine.js';
import { LearningDeploymentManager } from '../../../src/intelligence/learning/services/LearningDeploymentManager.js';
import { LearningRollbackManager } from '../../../src/intelligence/learning/services/LearningRollbackManager.js';
import type { LearningCandidate } from '../../../src/intelligence/learning/models/LearningCandidate.js';
import type { LearningEvaluation } from '../../../src/intelligence/learning/models/LearningEvaluation.js';
import { RollbackError, PolicyViolationError } from '../../../src/intelligence/learning/errors/LearningError.js';

describe('Deployment & Rollback Lifecycle', () => {
  let store: InMemoryLearningStore;
  let policyEngine: LearningPolicyEngine;
  let deploymentManager: LearningDeploymentManager;
  let rollbackManager: LearningRollbackManager;

  beforeEach(() => {
    store = new InMemoryLearningStore();
    policyEngine = new LearningPolicyEngine();
    deploymentManager = new LearningDeploymentManager(store, policyEngine);
    rollbackManager = new LearningRollbackManager(store);
  });

  const setupCandidateAndEvaluation = async (id: string): Promise<LearningCandidate> => {
    const candidate: LearningCandidate = {
      id,
      workspaceId: 'ws_prod',
      projectId: 'proj_main',
      candidateType: 'RETRIEVAL_WEIGHT_ADJUSTMENT',
      target: {
        system: 'RETRIEVAL',
        targetType: 'RESOURCE',
        targetId: 'src/api/auth.ts',
      },
      proposedChange: { resourceId: 'src/api/auth.ts', rankingScoreDelta: 0.15 },
      scope: {
        level: 'PROJECT',
        value: 'proj_main',
        workspaceId: 'ws_prod',
        projectId: 'proj_main',
      },
      evidence: [
        {
          evidenceId: 'ev_1',
          sourceType: 'USER',
          description: 'User confirmed relevance',
          value: 1.0,
          confidence: 0.95,
          timestamp: Date.now(),
          authority: 'USER_REPORTED',
          verificationPassed: true,
        },
        {
          evidenceId: 'ev_2',
          sourceType: 'VERIFICATION',
          description: 'Test suite passed',
          value: 1.0,
          confidence: 0.90,
          timestamp: Date.now(),
          authority: 'VERIFIED',
          verificationPassed: true,
        },
        {
          evidenceId: 'ev_3',
          sourceType: 'AGENT',
          description: 'Search usage',
          value: 1.0,
          confidence: 0.80,
          timestamp: Date.now(),
          authority: 'AGENT_REPORTED',
        },
      ],
      confidence: 0.88,
      authority: 'USER_REPORTED',
      expectedEffect: 'Improve auth search ranking',
      risk: 'LOW',
      reversibility: 'FULL',
      evaluationStatus: 'ACCEPTED',
      deploymentMode: 'SHADOW',
      reasoning: ['Supported by user and automated tests'],
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const evaluation: LearningEvaluation = {
      evaluationId: `eval_${id}`,
      candidateId: id,
      dimensions: {
        evidenceQuality: 0.9,
        sourceDiversity: 1.0,
        consistency: 1.0,
        recency: 0.9,
        scopePrecision: 0.9,
        reversibility: 1.0,
        outcomeSupport: 0.9,
        conflictLevel: 0.0,
      },
      overallScore: 0.88,
      isAccepted: true,
      recommendedAction: 'ACCEPT',
      risksIdentified: [],
      conflictsDetected: [],
      evaluatedAt: Date.now(),
      evaluator: 'AutomatedEvaluator',
      explanation: 'Compliant candidate',
    };

    await store.saveCandidate(candidate);
    await store.saveEvaluation(evaluation);
    return candidate;
  };

  it('should successfully deploy candidate and generate version 1 DeployedLearning', async () => {
    await setupCandidateAndEvaluation('cand_v1');
    const deployed = await deploymentManager.deployCandidate('cand_v1', 'admin_user');

    expect(deployed.id).toBeDefined();
    expect(deployed.version).toBe(1);
    expect(deployed.status).toBe('ACTIVE');
    expect(deployed.deployedBy).toBe('admin_user');

    const updatedCand = await store.getCandidate('cand_v1');
    expect(updatedCand?.evaluationStatus).toBe('DEPLOYED');
    expect(updatedCand?.deploymentMode).toBe('ACTIVE');
  });

  it('should supersede previous version when a new version is deployed for the same target', async () => {
    await setupCandidateAndEvaluation('cand_v1');
    const v1 = await deploymentManager.deployCandidate('cand_v1', 'admin_user');

    await setupCandidateAndEvaluation('cand_v2');
    const v2 = await deploymentManager.deployCandidate('cand_v2', 'admin_user');

    expect(v2.version).toBe(2);
    expect(v2.previousVersionId).toBe(v1.id);
    expect(v2.status).toBe('ACTIVE');

    const oldV1 = await store.getDeployed(v1.id);
    expect(oldV1?.status).toBe('SUPERSEDED');
  });

  it('should cleanly roll back a deployed learning and reactivate previous superseded version', async () => {
    await setupCandidateAndEvaluation('cand_v1');
    const v1 = await deploymentManager.deployCandidate('cand_v1', 'admin');

    await setupCandidateAndEvaluation('cand_v2');
    const v2 = await deploymentManager.deployCandidate('cand_v2', 'admin');

    // Rollback v2
    const rollback = await rollbackManager.rollbackLearning(
      v2.id,
      'Search ranking degraded for billing terms',
      'incident_responder'
    );

    expect(rollback.id).toBeDefined();
    expect(rollback.deployedLearningId).toBe(v2.id);
    expect(rollback.reason).toBe('Search ranking degraded for billing terms');

    // v2 should be ROLLED_BACK
    const currentV2 = await store.getDeployed(v2.id);
    expect(currentV2?.status).toBe('ROLLED_BACK');

    // v1 should be reactivated back to ACTIVE
    const restoredV1 = await store.getDeployed(v1.id);
    expect(restoredV1?.status).toBe('ACTIVE');
  });

  it('should reject rollback without justification reason', async () => {
    await setupCandidateAndEvaluation('cand_v1');
    const v1 = await deploymentManager.deployCandidate('cand_v1', 'admin');

    await expect(rollbackManager.rollbackLearning(v1.id, '', 'admin')).rejects.toThrow(
      RollbackError
    );
  });

  it('should allow disabling an active learning without full rollback', async () => {
    await setupCandidateAndEvaluation('cand_v1');
    const v1 = await deploymentManager.deployCandidate('cand_v1', 'admin');

    const disabled = await deploymentManager.disableLearning(v1.id, 'admin');
    expect(disabled.status).toBe('DISABLED');
  });
});
