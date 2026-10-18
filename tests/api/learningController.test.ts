import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { LearningController } from '../../src/api/controllers/LearningController.js';
import { InMemoryFeedbackStore } from '../../src/intelligence/learning/services/InMemoryFeedbackStore.js';
import { InMemoryLearningStore } from '../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { FeedbackNormalizer } from '../../src/intelligence/learning/services/FeedbackNormalizer.js';
import { FeedbackCollector } from '../../src/intelligence/learning/services/FeedbackCollector.js';
import { LearningSignalExtractor } from '../../src/intelligence/learning/services/LearningSignalExtractor.js';
import { LearningCandidateGenerator } from '../../src/intelligence/learning/services/LearningCandidateGenerator.js';
import { LearningEvaluator } from '../../src/intelligence/learning/services/LearningEvaluator.js';
import { LearningPolicyEngine } from '../../src/intelligence/learning/services/LearningPolicyEngine.js';
import { LearningDeploymentManager } from '../../src/intelligence/learning/services/LearningDeploymentManager.js';
import { LearningRollbackManager } from '../../src/intelligence/learning/services/LearningRollbackManager.js';
import { LearningIntelligenceService } from '../../src/intelligence/learning/services/LearningIntelligenceService.js';

describe('LearningController API Suite (Phase 9.7)', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let learningService: LearningIntelligenceService;
  let controller: LearningController;

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();

    const fbStore = new InMemoryFeedbackStore();
    const lStore = new InMemoryLearningStore();
    const normalizer = new FeedbackNormalizer();
    const collector = new FeedbackCollector(fbStore, normalizer);
    const signalExtractor = new LearningSignalExtractor(lStore);
    const candidateGenerator = new LearningCandidateGenerator(lStore);
    const evaluator = new LearningEvaluator(lStore);
    const policyEngine = new LearningPolicyEngine();
    const deploymentManager = new LearningDeploymentManager(lStore, policyEngine);
    const rollbackManager = new LearningRollbackManager(lStore);

    learningService = new LearningIntelligenceService(
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

    controller = new LearningController(learningService);
    controller.registerRoutes(router);
  });

  it('POST /feedback should record feedback and return 201', async () => {
    const req = requestService.createRequest({
      path: '/feedback',
      method: 'POST',
      body: {
        workspaceId: 'ws_api',
        projectId: 'proj_api',
        sourceType: 'USER',
        feedbackType: 'CONTEXT_USEFUL',
        targetType: 'RESOURCE',
        targetId: 'src/main.ts',
        value: 1.0,
      },
    });

    const res = await router.handle(req);
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    expect(res.data.feedbackType).toBe('CONTEXT_USEFUL');
  });

  it('GET /feedback should list feedback for workspace', async () => {
    await learningService.submitFeedback({
      workspaceId: 'ws_api',
      projectId: 'proj_api',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/main.ts',
    });

    const req = requestService.createRequest({
      path: '/feedback',
      method: 'GET',
      query: { workspaceId: 'ws_api' },
    });

    const res = await router.handle(req);
    expect(res.status).toBe(200);
    expect(res.data.count).toBe(1);
  });

  it('POST /learning/signals/extract should extract signals and return 200', async () => {
    await learningService.submitFeedback({
      workspaceId: 'ws_api',
      projectId: 'proj_api',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_MISSING',
      targetType: 'RESOURCE',
      targetId: 'src/config.ts',
      value: -1.0,
    });

    const req = requestService.createRequest({
      path: '/learning/signals/extract',
      method: 'POST',
      body: { workspaceId: 'ws_api', projectId: 'proj_api' },
    });

    const res = await router.handle(req);
    expect(res.status).toBe(200);
    expect(res.data.count).toBe(1);
    expect(res.data.signals[0].type).toBe('RESOURCE_OMISSION');
  });

  it('POST /learning/candidates/generate should generate and auto-evaluate candidates', async () => {
    await learningService.submitFeedback({
      workspaceId: 'ws_api',
      projectId: 'proj_api',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/auth.ts',
      value: 1.0,
    });

    await learningService.generateSignals('ws_api', 'proj_api');

    const req = requestService.createRequest({
      path: '/learning/candidates/generate',
      method: 'POST',
      body: { workspaceId: 'ws_api', projectId: 'proj_api' },
    });

    const res = await router.handle(req);
    expect(res.status).toBe(200);
    expect(res.data.count).toBe(1);
    expect(res.data.candidates[0].target.system).toBe('CONTEXT');
  });

  it('POST /learning/candidates/:id/deploy and POST /learning/deployed/:id/rollback should succeed', async () => {
    // Submit feedbacks
    for (let i = 1; i <= 3; i++) {
      await learningService.submitFeedback({
        workspaceId: 'ws_api',
        projectId: 'proj_api',
        sourceType: i === 1 ? 'USER' : i === 2 ? 'VERIFICATION' : 'AGENT',
        sourceId: `source_${i}`,
        feedbackType: 'RETRIEVAL_RELEVANT',
        targetType: 'RESOURCE',
        targetId: 'src/retrieval/index.ts',
        value: 1.0,
      });
    }

    await learningService.generateSignals('ws_api', 'proj_api');
    const candidates = await learningService.generateCandidates('ws_api', 'proj_api');
    const candId = candidates[0]!.id;

    // Deploy
    const deployReq = requestService.createRequest({
      path: `/learning/candidates/${candId}/deploy`,
      method: 'POST',
    });
    const deployRes = await router.handle(deployReq);
    expect(deployRes.status).toBe(201);
    const deployedId = deployRes.data.id;

    // Rollback
    const rbReq = requestService.createRequest({
      path: `/learning/deployed/${deployedId}/rollback`,
      method: 'POST',
      body: { reason: 'Test rollback via API' },
    });
    const rbRes = await router.handle(rbReq);
    expect(rbRes.status).toBe(200);
    expect(rbRes.data.reason).toBe('Test rollback via API');
  });

  it('GET /learning/explain/:id should return structured explanation', async () => {
    await learningService.submitFeedback({
      workspaceId: 'ws_api',
      projectId: 'proj_api',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/auth.ts',
      value: 1.0,
    });
    await learningService.generateSignals('ws_api', 'proj_api');
    const candidates = await learningService.generateCandidates('ws_api', 'proj_api');
    const candId = candidates[0]!.id;

    const req = requestService.createRequest({
      path: `/learning/explain/${candId}`,
      method: 'GET',
    });

    const res = await router.handle(req);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(candId);
    expect(res.data.type).toBe('CANDIDATE');
    expect(res.data.primaryReasons.length).toBeGreaterThan(0);
  });
});
