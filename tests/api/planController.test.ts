import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { PlanController } from '../../src/api/controllers/PlanController.js';
import {
  TaskPlannerService,
  InMemoryTaskPlanStore,
  TaskDecomposer,
  TaskDependencyResolver,
  TaskPlanValidator,
  TaskReadinessEvaluator,
  TaskPrioritizer,
  TaskAssignmentResolver,
  ApprovalGateResolver,
  TaskCheckpointManager,
  TaskPlanRevisionManager,
  TaskOrchestrator,
  TaskPlanStatus,
  TaskNodeStatus,
  ApprovalStatus
} from '../../src/agent/planning/index.js';

describe('PlanController API Suite (Phase 9.6)', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let store: InMemoryTaskPlanStore;
  let plannerService: TaskPlannerService;
  let approvalResolver: ApprovalGateResolver;
  let checkpointManager: TaskCheckpointManager;
  let revisionManager: TaskPlanRevisionManager;
  let planController: PlanController;

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();

    store = new InMemoryTaskPlanStore();
    const decomposer = new TaskDecomposer();
    const dependencyResolver = new TaskDependencyResolver();
    const validator = new TaskPlanValidator(store);
    const readinessEvaluator = new TaskReadinessEvaluator();
    const prioritizer = new TaskPrioritizer(dependencyResolver);
    const assignmentResolver = new TaskAssignmentResolver();
    approvalResolver = new ApprovalGateResolver();
    checkpointManager = new TaskCheckpointManager(store);
    revisionManager = new TaskPlanRevisionManager(store);

    const orchestrator = new TaskOrchestrator(
      store,
      validator,
      dependencyResolver,
      readinessEvaluator,
      assignmentResolver,
      approvalResolver
    );

    plannerService = new TaskPlannerService(
      store,
      decomposer,
      validator,
      dependencyResolver,
      readinessEvaluator,
      prioritizer,
      approvalResolver,
      orchestrator,
      checkpointManager,
      revisionManager
    );

    planController = new PlanController(
      plannerService,
      approvalResolver,
      revisionManager,
      checkpointManager
    );

    planController.registerRoutes(router);
  });

  it('POST /plans should create a new plan and return 201', async () => {
    const req = requestService.createRequest({
      path: '/plans',
      method: 'POST',
      body: {
        workspaceId: 'ws_alpha',
        projectId: 'proj_auth',
        title: 'Add Google OAuth',
        objective: 'Add authentication with Google OAuth',
      },
    });

    const res = await router.handle(req);
    expect(res.status).toBe(201);
    const data = res.data as any;
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Add Google OAuth');
    expect(data.nodes.length).toBeGreaterThan(0);
  });

  it('GET /plans/:id should return 200 with the requested plan', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      title: 'Plan to Retrieve',
      objective: 'Retrieve this plan via API',
      createdBy: 'user_test',
    });

    const req = requestService.createRequest({
      path: `/plans/${plan.id}`,
      method: 'GET',
    });

    const res = await router.handle(req);
    expect(res.status).toBe(200);
    const data = res.data as any;
    expect(data.id).toBe(plan.id);
  });

  it('POST /plans/:id/validate should validate the plan', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      title: 'Plan to Validate',
      objective: 'Ensure plan validity',
      createdBy: 'user_test',
    });

    const req = requestService.createRequest({
      path: `/plans/${plan.id}/validate`,
      method: 'POST',
    });

    const res = await router.handle(req);
    expect(res.status).toBe(200);
    const data = res.data as any;
    expect(data.valid).toBe(true);
  });

  it('GET /plans/:id/ready and /blocked should partition tasks', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      title: 'Plan Ready Check',
      objective: 'Check readiness partition',
      createdBy: 'user_test',
    });

    const reqReady = requestService.createRequest({
      path: `/plans/${plan.id}/ready`,
      method: 'GET',
    });
    const resReady = await router.handle(reqReady);
    expect(resReady.status).toBe(200);
    const readyData = resReady.data as any;
    expect(readyData.readyTasks.length).toBeGreaterThanOrEqual(1);

    const reqBlocked = requestService.createRequest({
      path: `/plans/${plan.id}/blocked`,
      method: 'GET',
    });
    const resBlocked = await router.handle(reqBlocked);
    expect(resBlocked.status).toBe(200);
    const blockedData = resBlocked.data as any;
    expect(blockedData.blockedTasks.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /plans/:id/start, /pause, and /resume should manage lifecycle via API', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      title: 'Lifecycle Plan',
      objective: 'Test lifecycle endpoints',
      createdBy: 'user_test',
    });

    // Start
    const startReq = requestService.createRequest({
      path: `/plans/${plan.id}/start`,
      method: 'POST',
    });
    const startRes = await router.handle(startReq);
    expect(startRes.status).toBe(200);
    expect((startRes.data as any).status).toBe(TaskPlanStatus.RUNNING);

    // Pause
    const pauseReq = requestService.createRequest({
      path: `/plans/${plan.id}/pause`,
      method: 'POST',
      body: { reason: 'Paused for audit' },
    });
    const pauseRes = await router.handle(pauseReq);
    expect(pauseRes.status).toBe(200);
    expect((pauseRes.data as any).status).toBe(TaskPlanStatus.PAUSED);

    // Resume
    const resumeReq = requestService.createRequest({
      path: `/plans/${plan.id}/resume`,
      method: 'POST',
    });
    const resumeRes = await router.handle(resumeReq);
    expect(resumeRes.status).toBe(200);
    expect((resumeRes.data as any).status).toBe(TaskPlanStatus.RUNNING);
  });

  it('POST /plans/:id/advance should execute ready tasks and advance plan', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      title: 'Advance Plan',
      objective: 'Test advance endpoint',
      createdBy: 'user_test',
    });
    await plannerService.startPlan(plan.id);

    const advReq = requestService.createRequest({
      path: `/plans/${plan.id}/advance`,
      method: 'POST',
    });
    const advRes = await router.handle(advReq);
    expect(advRes.status).toBe(200);
    expect((advRes.data as any).tasksStarted.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /plans/:id/explain should return plan explanation breakdown', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_alpha',
      projectId: 'proj_auth',
      title: 'Explainable Plan',
      objective: 'Explain planning decisions',
      createdBy: 'user_test',
    });

    const expReq = requestService.createRequest({
      path: `/plans/${plan.id}/explain`,
      method: 'GET',
    });
    const expRes = await router.handle(expReq);
    expect(expRes.status).toBe(200);
    const expData = expRes.data as any;
    expect(expData.planId).toBe(plan.id);
    expect(expData.nodes.length).toBeGreaterThan(0);
  });
});
