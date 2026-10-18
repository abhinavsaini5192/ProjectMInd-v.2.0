import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { LearningAggregationJobHandler } from '../../../src/intelligence/learning/jobs/LearningAggregationJobHandler.js';
import { LearningEvaluationJobHandler } from '../../../src/intelligence/learning/jobs/LearningEvaluationJobHandler.js';
import { LearningMaintenanceJobHandler } from '../../../src/intelligence/learning/jobs/LearningMaintenanceJobHandler.js';
import type { Job } from '../../../src/jobs/models/Job.js';
import type { JobExecutionContext } from '../../../src/jobs/registry/IJobHandler.js';
import { JobError } from '../../../src/jobs/models/JobError.js';

describe('Jobs & Lifecycle Integration (Phase 8 Jobs Queue)', () => {
  let fbStore: InMemoryFeedbackStore;
  let lStore: InMemoryLearningStore;
  let service: LearningIntelligenceService;

  beforeEach(() => {
    fbStore = new InMemoryFeedbackStore();
    lStore = new InMemoryLearningStore();
    const normalizer = new FeedbackNormalizer();
    const collector = new FeedbackCollector(fbStore, normalizer);
    const signalExtractor = new LearningSignalExtractor(lStore);
    const candidateGenerator = new LearningCandidateGenerator(lStore);
    const evaluator = new LearningEvaluator(lStore);
    const policyEngine = new LearningPolicyEngine();
    const deploymentManager = new LearningDeploymentManager(lStore, policyEngine);
    const rollbackManager = new LearningRollbackManager(lStore);
    service = new LearningIntelligenceService(
      fbStore,
      lStore,
      collector,
      signalExtractor,
      candidateGenerator,
      evaluator,
      policyEngine,
      deploymentManager,
      rollbackManager
    );
  });

  const createMockContext = (): JobExecutionContext => ({
    workerId: 'worker-1',
    signal: new AbortController().signal,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
  });

  it('should validate and execute LearningAggregationJobHandler', async () => {
    const handler = new LearningAggregationJobHandler(service);

    // Record some feedback
    await service.submitFeedback({
      workspaceId: 'ws_job',
      projectId: 'proj_job',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/main.ts',
      value: 1.0,
    });

    const job: Job<any> = {
      jobId: 'job_agg_1',
      type: 'LEARNING_AGGREGATION',
      status: 'RUNNING',
      priority: 'NORMAL',
      workspaceId: 'ws_job',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 30000,
      version: 1,
      payload: { workspaceId: 'ws_job', projectId: 'proj_job' },
    };

    expect(() => handler.validate(job)).not.toThrow();

    const context = createMockContext();
    const result = await handler.execute(job, context);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics?.['signalsExtracted']).toBe(1);
    expect(result.metrics?.['candidatesGenerated']).toBe(1);
    expect(context.updateProgress).toHaveBeenCalledWith(100, 100, expect.any(String));
  });

  it('should throw JobError on invalid payload in LearningAggregationJobHandler', () => {
    const handler = new LearningAggregationJobHandler(service);
    const invalidJob: Job<any> = {
      jobId: 'job_bad',
      type: 'LEARNING_AGGREGATION',
      status: 'RUNNING',
      priority: 'NORMAL',
      workspaceId: 'ws_job',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 30000,
      version: 1,
      payload: {},
    };

    expect(() => handler.validate(invalidJob)).toThrow(JobError);
  });

  it('should execute LearningEvaluationJobHandler for candidate', async () => {
    const handler = new LearningEvaluationJobHandler(service);

    await service.submitFeedback({
      workspaceId: 'ws_job',
      projectId: 'proj_job',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/service.ts',
      value: 1.0,
    });

    await service.generateSignals('ws_job', 'proj_job');
    const candidates = await service.generateCandidates('ws_job', 'proj_job');
    expect(candidates).toHaveLength(1);

    const job: Job<any> = {
      jobId: 'job_eval_1',
      type: 'LEARNING_EVALUATION',
      status: 'RUNNING',
      priority: 'NORMAL',
      workspaceId: 'ws_job',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 30000,
      version: 1,
      payload: {
        workspaceId: 'ws_job',
        projectId: 'proj_job',
        candidateId: candidates[0]!.id,
      },
    };

    expect(() => handler.validate(job)).not.toThrow();

    const context = createMockContext();
    const result = await handler.execute(job, context);

    expect(result.metrics?.['isAccepted']).toBe(1);
    expect((result.output as Record<string, unknown> | undefined)?.['recommendedAction']).toBe('ACCEPT');
  });

  it('should expire stale candidates via LearningMaintenanceJobHandler', async () => {
    const handler = new LearningMaintenanceJobHandler(lStore);

    // Save an expired candidate (validUntil in the past)
    await lStore.saveCandidate({
      id: 'cand_stale',
      workspaceId: 'ws_job',
      projectId: 'proj_job',
      candidateType: 'TEMP_HEURISTIC',
      target: { system: 'CONTEXT', targetType: 'RESOURCE', targetId: 'file.ts' },
      proposedChange: {},
      scope: { level: 'PROJECT', value: 'proj_job', workspaceId: 'ws_job', projectId: 'proj_job' },
      evidence: [],
      confidence: 0.8,
      authority: 'OBSERVED',
      expectedEffect: 'temporary',
      risk: 'LOW',
      reversibility: 'FULL',
      evaluationStatus: 'PROPOSED',
      deploymentMode: 'SHADOW',
      reasoning: [],
      version: 1,
      validUntil: Date.now() - 10000, // Expired
      createdAt: Date.now() - 20000,
      updatedAt: Date.now() - 20000,
    });

    const job: Job<any> = {
      jobId: 'job_maint_1',
      type: 'LEARNING_MAINTENANCE',
      status: 'RUNNING',
      priority: 'LOW',
      workspaceId: 'ws_job',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 30000,
      version: 1,
      payload: { workspaceId: 'ws_job', projectId: 'proj_job' },
    };

    const context = createMockContext();
    const result = await handler.execute(job, context);

    expect(result.metrics?.['expiredCount']).toBe(1);

    const cand = await lStore.getCandidate('cand_stale');
    expect(cand?.evaluationStatus).toBe('EXPIRED');
  });
});
