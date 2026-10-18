import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFeedbackStore } from '../../../src/intelligence/learning/services/InMemoryFeedbackStore.js';
import { InMemoryLearningStore } from '../../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { FeedbackNormalizer } from '../../../src/intelligence/learning/services/FeedbackNormalizer.js';
import { FeedbackCollector } from '../../../src/intelligence/learning/services/FeedbackCollector.js';
import { LearningSignalExtractor } from '../../../src/intelligence/learning/services/LearningSignalExtractor.js';
import { LearningCandidateGenerator } from '../../../src/intelligence/learning/services/LearningCandidateGenerator.js';

describe('Learning Signal & Candidate Generation', () => {
  let feedbackStore: InMemoryFeedbackStore;
  let learningStore: InMemoryLearningStore;
  let normalizer: FeedbackNormalizer;
  let collector: FeedbackCollector;
  let signalExtractor: LearningSignalExtractor;
  let candidateGenerator: LearningCandidateGenerator;

  beforeEach(() => {
    feedbackStore = new InMemoryFeedbackStore();
    learningStore = new InMemoryLearningStore();
    normalizer = new FeedbackNormalizer();
    collector = new FeedbackCollector(feedbackStore, normalizer);
    signalExtractor = new LearningSignalExtractor(learningStore);
    candidateGenerator = new LearningCandidateGenerator(learningStore);
  });

  it('should aggregate multiple feedbacks into a directional learning signal', async () => {
    // 3 independent agents report a missing context file for authentication
    for (let i = 1; i <= 3; i++) {
      await collector.recordFeedback({
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        sourceType: 'AGENT',
        sourceId: `agent_${i}`,
        feedbackType: 'CONTEXT_MISSING',
        targetType: 'RESOURCE',
        targetId: 'src/auth/jwtSecret.ts',
        taskReference: `task_${i}`,
        provenance: { isExplicit: true },
      });
    }

    const items = await feedbackStore.queryFeedback({ workspaceId: 'ws_1' });
    const signals = await signalExtractor.extractSignals(items);

    expect(signals).toHaveLength(1);
    const sig = signals[0]!;
    expect(sig.target.targetId).toBe('src/auth/jwtSecret.ts');
    expect(sig.type).toBe('RESOURCE_OMISSION');
    expect(sig.direction).toBe('NEGATIVE'); // CONTEXT_MISSING is a negative gap
    expect(sig.evidence).toHaveLength(3);
    expect(sig.provenance.uniqueSources).toHaveLength(3);
    expect(sig.confidence).toBeGreaterThan(0.5);
  });

  it('should generate a concrete context adaptation candidate from omission signal', async () => {
    await collector.recordFeedback({
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_MISSING',
      targetType: 'RESOURCE',
      targetId: 'src/auth/jwtSecret.ts',
      provenance: { isExplicit: true },
    });

    const items = await feedbackStore.queryFeedback({ workspaceId: 'ws_1' });
    const signals = await signalExtractor.extractSignals(items);
    const candidates = await candidateGenerator.generateCandidates(signals);

    expect(candidates).toHaveLength(1);
    const cand = candidates[0]!;
    expect(cand.target.system).toBe('CONTEXT');
    expect(cand.candidateType).toBe('CONTEXT_RESOURCE_BOOST');
    expect(cand.evaluationStatus).toBe('PROPOSED');
    expect(cand.deploymentMode).toBe('SHADOW');
    expect(cand.reversibility).toBe('FULL');
    expect(cand.risk).toBe('LOW');
  });

  it('should detect contradictory feedback and record a LearningConflict', async () => {
    // Agent A says file is useful
    await collector.recordFeedback({
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      sourceType: 'AGENT',
      sourceId: 'agent_A',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/utils/helpers.ts',
      taskReference: 'task_auth',
      value: 1.0,
    });

    // Agent B says file is irrelevant
    await collector.recordFeedback({
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      sourceType: 'AGENT',
      sourceId: 'agent_B',
      feedbackType: 'CONTEXT_IRRELEVANT',
      targetType: 'RESOURCE',
      targetId: 'src/utils/helpers.ts',
      taskReference: 'task_billing',
      value: -1.0,
    });

    const items = await feedbackStore.queryFeedback({ workspaceId: 'ws_1' });
    const signals = await signalExtractor.extractSignals(items);

    expect(signals).toHaveLength(1);
    const conflicts = await learningStore.getConflicts('ws_1');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.targetId).toBe('src/utils/helpers.ts');
    expect(conflicts[0]!.conflictType).toBe('CONTRADICTORY_EVALUATION');
  });

  it('should generate a planning decomposition candidate for repeated planning feedback', async () => {
    await collector.recordFeedback({
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      sourceType: 'PLAN',
      sourceId: 'planner_1',
      feedbackType: 'PLAN_INCOMPLETE',
      targetType: 'TASK_TYPE',
      targetId: 'oauth-integration',
      value: -0.8,
    });

    const items = await feedbackStore.queryFeedback({ workspaceId: 'ws_1' });
    const signals = await signalExtractor.extractSignals(items);
    const candidates = await candidateGenerator.generateCandidates(signals);

    expect(candidates).toHaveLength(1);
    const cand = candidates[0]!;
    expect(cand.target.system).toBe('PLANNING');
    expect(cand.proposedChange['recommendation']).toBe('ADD_VALIDATION_STEP');
    expect(cand.risk).toBe('MEDIUM');
  });
});
