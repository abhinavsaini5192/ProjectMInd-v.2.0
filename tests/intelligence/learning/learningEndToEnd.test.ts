import { describe, it, expect } from 'vitest';
import { InMemoryFeedbackStore } from '../../../src/intelligence/learning/services/InMemoryFeedbackStore.js';
import { InMemoryLearningStore } from '../../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { FeedbackNormalizer } from '../../../src/intelligence/learning/services/FeedbackNormalizer.js';
import { FeedbackCollector } from '../../../src/intelligence/learning/services/FeedbackCollector.js';
import { LearningSignalExtractor } from '../../../src/intelligence/learning/services/LearningSignalExtractor.js';
import { LearningCandidateGenerator } from '../../../src/intelligence/learning/services/LearningCandidateGenerator.js';
import { LearningEvaluator } from '../../../src/intelligence/learning/services/LearningEvaluator.js';
import { LearningPolicyEngine } from '../../../src/intelligence/learning/services/LearningPolicyEngine.js';
import { LearningDeploymentManager } from '../../../src/intelligence/learning/services/LearningDeploymentManager.js';
import { LearningRollbackManager } from '../../../src/intelligence/learning/services/LearningRollbackManager.js';
import { LearningIntelligenceService } from '../../../src/intelligence/learning/services/LearningIntelligenceService.js';
import { ContextLearningAdapter } from '../../../src/intelligence/learning/integrations/ContextLearningAdapter.js';
import type { ContextCandidate, RelevanceDimensions } from '../../../src/context/models/ContextCandidate.js';

describe('Phase 9.7 End-to-End Learning Loop (Section 40)', () => {
  it('should execute the complete 19-step learning loop from interaction to deployment and rollback', async () => {
    const workspaceId = 'ws_enterprise';
    const projectId = 'proj_auth_service';
    const targetResourceId = 'src/auth/jwtSecretProvider.ts';

    // Initialize canonical learning intelligence stack
    const feedbackStore = new InMemoryFeedbackStore();
    const learningStore = new InMemoryLearningStore();
    const normalizer = new FeedbackNormalizer();
    const collector = new FeedbackCollector(feedbackStore, normalizer);
    const signalExtractor = new LearningSignalExtractor(learningStore);
    const candidateGenerator = new LearningCandidateGenerator(learningStore);
    const evaluator = new LearningEvaluator(learningStore);
    const policyEngine = new LearningPolicyEngine();
    const deploymentManager = new LearningDeploymentManager(learningStore, policyEngine);
    const rollbackManager = new LearningRollbackManager(learningStore);

    const learningService = new LearningIntelligenceService(
      feedbackStore,
      learningStore,
      collector,
      signalExtractor,
      candidateGenerator,
      evaluator,
      policyEngine,
      deploymentManager,
      rollbackManager
    );

    const contextAdapter = new ContextLearningAdapter(deploymentManager);

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

    // Initial baseline context package candidates (before learning)
    const initialCandidates: ContextCandidate[] = [
      {
        candidateId: 'cand_auth_core',
        id: 'cand_auth_core',
        candidateType: 'FILE',
        name: 'auth.ts',
        path: 'src/auth/auth.ts',
        type: 'FILE',
        score: 0.85,
        priority: 'HIGH',
        primaryEvidence: 'lexical relevance',
        isMandatory: true,
        estimatedTokens: 300,
        sizeTokens: 300,
        dimensions: defaultDimensions,
      },
      {
        candidateId: 'cand_jwt_secret',
        id: 'cand_jwt_secret',
        candidateType: 'FILE',
        name: 'jwtSecretProvider.ts',
        path: targetResourceId,
        type: 'FILE',
        score: 0.50, // lower score, not prioritized initially
        priority: 'LOW',
        primaryEvidence: 'marginal match',
        isMandatory: false,
        estimatedTokens: 150,
        sizeTokens: 150,
        dimensions: defaultDimensions,
      },
    ];

    // --- Steps 1 to 8: Multi-agent execution iterations where file was omitted and requested ---
    // Across 4 independent tasks, agents notice the omission, request it, and tasks pass verification.
    for (let taskIndex = 1; taskIndex <= 4; taskIndex++) {
      const taskId = `task_auth_${taskIndex}`;
      const agentId = `coding_agent_${taskIndex}`;

      // Step 3-5: Record CONTEXT_MISSING for targetResourceId
      await collector.recordFeedback({
        workspaceId,
        projectId,
        sourceType: 'CONTEXT',
        sourceId: agentId,
        feedbackType: 'CONTEXT_MISSING',
        targetType: 'RESOURCE',
        targetId: targetResourceId,
        taskReference: taskId,
        provenance: {
          isExplicit: true,
          actorId: agentId,
        },
      });

      // Step 6-7: Task succeeds and verification passes
      await collector.recordVerificationFeedback({
        workspaceId,
        projectId,
        verificationId: `verif_run_${taskIndex}`,
        passed: true,
        taskId,
        targetResources: [targetResourceId],
        actorId: 'test_runner',
      });
    }

    const recordedFeedbacks = await feedbackStore.queryFeedback({ workspaceId });
    expect(recordedFeedbacks.length).toBe(8); // 4 context omissions + 4 verification results

    // --- Step 9: Learning signals are generated from evidence ---
    const signals = await learningService.generateSignals(workspaceId, projectId);
    expect(signals.length).toBeGreaterThan(0);
    const omissionSignal = signals.find((s) => s.target.targetId === targetResourceId);
    expect(omissionSignal).toBeDefined();
    expect(omissionSignal?.provenance.feedbackCount).toBe(4);
    expect(omissionSignal?.confidence).toBeGreaterThan(0.55);

    // --- Step 10: A project-scoped LearningCandidate is created ---
    const candidates = await candidateGenerator.generateCandidates(signals);
    const candidate = candidates.find((c) => c.target.targetId === targetResourceId);
    expect(candidate).toBeDefined();
    expect(candidate?.target.system).toBe('CONTEXT');
    expect(candidate?.scope.level).toBe('RESOURCE');
    expect(candidate?.reversibility).toBe('FULL');

    // --- Step 11: Evidence is evaluated ---
    const evaluation = await evaluator.evaluateCandidate(candidate!);
    expect(evaluation.overallScore).toBeGreaterThan(0.70);
    expect(evaluation.isAccepted).toBe(true);

    // --- Step 12: Candidate enters SHADOW mode ---
    expect(candidate?.deploymentMode).toBe('SHADOW');

    // --- Step 13-14: Shadow evaluation against baseline metrics shows improved relevance ---
    const shadowComp = await evaluator.evaluateShadow(candidate!, { relevanceScore: 0.60 });
    expect(shadowComp.candidateMetric).toBeGreaterThan(shadowComp.controlMetric);
    expect(shadowComp.relativeImprovement).toBeGreaterThan(0.05);

    // --- Step 15: Policy allows deployment ---
    const policyResult = policyEngine.validateCandidateAgainstPolicy(candidate!, evaluation);
    expect(policyResult.passed).toBe(true);
    expect(policyResult.violations).toHaveLength(0);

    // --- Step 16: Learning is deployed ---
    const deployed = await deploymentManager.deployCandidate(candidate!.id, 'lead_architect');
    expect(deployed.id).toBeDefined();
    expect(deployed.version).toBe(1);
    expect(deployed.status).toBe('ACTIVE');

    // --- Step 17: Future context planning uses the learned association ---
    const adaptedCandidates = await contextAdapter.applyLearnedAdjustments(
      initialCandidates,
      workspaceId,
      projectId
    );
    const adaptedSecret = adaptedCandidates.find((c) => c.path === targetResourceId);
    expect(adaptedSecret).toBeDefined();
    // Prior score 0.50 + learned boost delta
    expect(adaptedSecret?.score).toBeGreaterThan(0.50);
    expect(adaptedSecret?.primaryEvidence).toContain('Learned weight adjustment');

    // --- Step 18: The effect is measured and tracked as a LearningImpact record ---
    await learningStore.saveImpact({
      id: 'impact_1',
      deployedLearningId: deployed.id,
      targetSystem: 'CONTEXT',
      impactType: 'SUPPORTED',
      metricName: 'contextRelevanceScore',
      baselineValue: 0.50,
      currentValue: adaptedSecret!.score,
      delta: adaptedSecret!.score - 0.50,
      sampleCount: 4,
      measuredAt: Date.now(),
      explanation: 'Context score improved by learned association',
    });

    const impacts = await learningStore.getImpacts(deployed.id);
    expect(impacts).toHaveLength(1);
    expect(impacts[0]!.delta).toBeGreaterThan(0);

    // --- Step 19: If later evidence shows degradation, the learning is rolled back ---
    const rollback = await rollbackManager.rollbackLearning(
      deployed.id,
      'Performance audit: jwtSecretProvider.ts added unwanted token overhead',
      'reliability_lead'
    );

    expect(rollback.id).toBeDefined();
    expect(rollback.deployedLearningId).toBe(deployed.id);
    expect(rollback.reason).toContain('Performance audit');

    const deployedAfterRollback = await learningStore.getDeployed(deployed.id);
    expect(deployedAfterRollback?.status).toBe('ROLLED_BACK');

    // Post-rollback context selection returns to baseline without learned boost
    const revertedCandidates = await contextAdapter.applyLearnedAdjustments(
      initialCandidates,
      workspaceId,
      projectId
    );
    const revertedSecret = revertedCandidates.find((c) => c.path === targetResourceId);
    expect(revertedSecret?.score).toBe(0.50); // Restored to clean unboosted baseline
  });
});
