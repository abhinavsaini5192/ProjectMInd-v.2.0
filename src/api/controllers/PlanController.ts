import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { ITaskPlannerService } from '../../agent/planning/interfaces/ITaskPlanner.js';
import type { IApprovalGateResolver } from '../../agent/planning/interfaces/IApprovalGateResolver.js';
import type { ITaskPlanRevisionManager } from '../../agent/planning/interfaces/ITaskPlanRevisionManager.js';
import type { ITaskCheckpointManager } from '../../agent/planning/interfaces/ITaskCheckpointManager.js';
import { ApiError } from '../errors/ApiError.js';
import { PlanNotFoundError, PlanValidationError } from '../../agent/planning/errors/PlanningError.js';

export class PlanController extends BaseApiController {
  constructor(
    private readonly plannerService: ITaskPlannerService,
    private readonly approvalResolver?: IApprovalGateResolver | undefined,
    private readonly revisionManager?: ITaskPlanRevisionManager | undefined,
    private readonly checkpointManager?: ITaskCheckpointManager | undefined
  ) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    router.post('/plans', this.handleCreatePlan.bind(this));
    router.get('/plans', this.handleListPlans.bind(this));
    router.get('/plans/:id', this.handleGetPlan.bind(this));
    router.post('/plans/:id/validate', this.handleValidatePlan.bind(this));

    router.get('/plans/:id/tasks', this.handleListTasks.bind(this));
    router.get('/plans/:id/ready', this.handleGetReadyTasks.bind(this));
    router.get('/plans/:id/blocked', this.handleGetBlockedTasks.bind(this));

    router.post('/plans/:id/start', this.handleStartPlan.bind(this));
    router.post('/plans/:id/pause', this.handlePausePlan.bind(this));
    router.post('/plans/:id/resume', this.handleResumePlan.bind(this));
    router.post('/plans/:id/cancel', this.handleCancelPlan.bind(this));
    router.post('/plans/:id/advance', this.handleAdvancePlan.bind(this));

    router.post('/plans/:id/replan', this.handleReplan.bind(this));
    router.post('/plans/:id/checkpoints', this.handleCreateCheckpoint.bind(this));
    router.post('/plans/:id/restore', this.handleRestoreCheckpoint.bind(this));

    router.post('/plans/:id/approvals/:nodeId/approve', this.handleApproveNode.bind(this));
    router.post('/plans/:id/approvals/:nodeId/reject', this.handleRejectNode.bind(this));

    router.get('/plans/:id/explain', this.handleExplainPlan.bind(this));
  }

  private async handleCreatePlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const body = (request.body as Record<string, any>) ?? {};
    if (!body['title'] || !body['objective']) {
      throw ApiError.badRequest('Fields "title" and "objective" are required.');
    }

    const workspaceId = body['workspaceId'] ?? request.context.workspaceId;
    const projectId = body['projectId'] ?? (request.context as any).projectId;
    if (!workspaceId || !projectId) {
      throw ApiError.badRequest('Both "workspaceId" and "projectId" are required.');
    }

    this.checkScope(request, workspaceId, projectId);

    const plan = await this.plannerService.createPlan({
      workspaceId,
      projectId,
      repositoryIds: body['repositoryIds'] ?? ['default'],
      title: body['title'],
      objective: body['objective'],
      description: body['description'],
      createdBy: body['createdBy'] ?? 'developer',
      source: body['source'] ?? 'USER_REQUEST',
      targetFeatures: body['targetFeatures'],
      targetResources: body['targetResources'],
      maxSteps: body['maxSteps'],
      metadata: body['metadata'],
    });

    return this.created(request, plan, `/plans/${plan.id}`);
  }

  private async handleListPlans(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = request.query['workspaceId'] ?? request.context.workspaceId;
    const projectId = request.query['projectId'] ?? (request.context as any).projectId;

    this.checkScope(request, workspaceId, projectId);

    const plans = await this.plannerService.listPlans({
      workspaceId,
      projectId,
      status: request.query['status'],
      limit: request.query['limit'] ? Number(request.query['limit']) : undefined,
    });

    return this.ok(request, { count: plans.length, plans });
  }

  private async handleGetPlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    try {
      const plan = await this.plannerService.getPlan(planId);
      this.checkScope(request, plan.workspaceId, plan.projectId);
      return this.ok(request, plan);
    } catch (err: any) {
      if (err instanceof PlanNotFoundError) {
        throw ApiError.notFound(err.message);
      }
      throw err;
    }
  }

  private async handleValidatePlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    try {
      const plan = await this.plannerService.getPlan(planId);
      this.checkScope(request, plan.workspaceId, plan.projectId);
      const result = await this.plannerService.validatePlan(planId);
      return this.ok(request, result);
    } catch (err: any) {
      if (err instanceof PlanNotFoundError) {
        throw ApiError.notFound(err.message);
      }
      throw err;
    }
  }

  private async handleListTasks(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);
    return this.ok(request, { count: plan.nodes.length, tasks: plan.nodes });
  }

  private async handleGetReadyTasks(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);
    const readyTasks = await this.plannerService.getReadyNodes(planId);
    return this.ok(request, { count: readyTasks.length, readyTasks });
  }

  private async handleGetBlockedTasks(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);
    const blockedTasks = await this.plannerService.getBlockedNodes(planId);
    return this.ok(request, { count: blockedTasks.length, blockedTasks });
  }

  private async handleStartPlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    try {
      const started = await this.plannerService.startPlan(planId);
      return this.ok(request, started);
    } catch (err: any) {
      if (err instanceof PlanValidationError) {
        throw ApiError.badRequest(err.message);
      }
      throw err;
    }
  }

  private async handlePausePlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    const paused = await this.plannerService.pausePlan(planId, body['reason']);
    return this.ok(request, paused);
  }

  private async handleResumePlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    const resumed = await this.plannerService.resumePlan(planId);
    return this.ok(request, resumed);
  }

  private async handleCancelPlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    const cancelled = await this.plannerService.cancelPlan(planId, body['reason']);
    return this.ok(request, cancelled);
  }

  private async handleAdvancePlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    const result = await this.plannerService.advancePlan(planId);
    return this.ok(request, result);
  }

  private async handleReplan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!planId || !body['failedNodeId'] || !body['errorReason']) {
      throw ApiError.badRequest('Parameters "id", "failedNodeId", and "errorReason" are required.');
    }

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    if (!this.revisionManager) {
      throw ApiError.internal('Revision manager is not configured.');
    }

    const revised = await this.revisionManager.replanAfterFailure(
      planId,
      body['failedNodeId'],
      body['errorReason'],
      body['createdBy'] ?? 'developer'
    );

    return this.ok(request, revised);
  }

  private async handleCreateCheckpoint(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    if (!this.checkpointManager) {
      throw ApiError.internal('Checkpoint manager is not configured.');
    }

    const checkpoint = await this.checkpointManager.createCheckpoint(planId, body['description']);
    return this.created(request, checkpoint);
  }

  private async handleRestoreCheckpoint(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!planId || !body['checkpointId']) {
      throw ApiError.badRequest('Fields "id" and "checkpointId" are required.');
    }

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    if (!this.checkpointManager) {
      throw ApiError.internal('Checkpoint manager is not configured.');
    }

    const restored = await this.checkpointManager.restoreCheckpoint(body['checkpointId']);
    return this.ok(request, restored);
  }

  private async handleApproveNode(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    const nodeId = request.params['nodeId'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!planId || !nodeId) throw ApiError.badRequest('Parameters "id" and "nodeId" are required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    const node = plan.nodes.find((n) => n.id === nodeId);
    if (!node) throw ApiError.notFound(`Node '${nodeId}' not found.`);

    if (!this.approvalResolver) {
      throw ApiError.internal('Approval resolver is not configured.');
    }

    const approvedNode = this.approvalResolver.approveNode(node, body['approver'] ?? 'developer');
    await (this.plannerService as any).store.updateNode(planId, approvedNode);

    return this.ok(request, approvedNode);
  }

  private async handleRejectNode(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    const nodeId = request.params['nodeId'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!planId || !nodeId) throw ApiError.badRequest('Parameters "id" and "nodeId" are required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    const node = plan.nodes.find((n) => n.id === nodeId);
    if (!node) throw ApiError.notFound(`Node '${nodeId}' not found.`);

    if (!this.approvalResolver) {
      throw ApiError.internal('Approval resolver is not configured.');
    }

    const rejectedNode = this.approvalResolver.rejectNode(
      node,
      body['rejecter'] ?? 'developer',
      body['reason'] ?? 'Rejected by policy'
    );
    await (this.plannerService as any).store.updateNode(planId, rejectedNode);

    return this.ok(request, rejectedNode);
  }

  private async handleExplainPlan(request: ApiRequest): Promise<ApiResponse<any>> {
    const planId = request.params['id'];
    if (!planId) throw ApiError.badRequest('Parameter "id" is required.');

    const plan = await this.plannerService.getPlan(planId);
    this.checkScope(request, plan.workspaceId, plan.projectId);

    const explanation = await this.plannerService.explainPlan(planId);
    return this.ok(request, explanation);
  }

  private checkScope(request: ApiRequest, workspaceId?: string, projectId?: string): void {
    const sec = (request.context as any).security ?? (request.context as any).securityContext;
    if (sec) {
      const isAdmin = typeof sec.isGlobalAdmin === 'function' ? sec.isGlobalAdmin() : false;
      if (!isAdmin) {
        if (sec.workspaceId && sec.workspaceId !== '*' && workspaceId && sec.workspaceId !== workspaceId) {
          throw ApiError.invalidScope(`Workspace scope violation: ${workspaceId}`);
        }
        if (sec.projectId && sec.projectId !== '*' && projectId && sec.projectId !== projectId) {
          throw ApiError.invalidScope(`Project scope violation: ${projectId}`);
        }
      }
    }
  }
}
