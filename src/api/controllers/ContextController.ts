import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import type { IAgentContextSessionManager } from '../../agent/context/interfaces/IAgentContextSessionManager.js';
import type { ContextRequest } from '../../context/models/ContextRequest.js';
import { ApiError } from '../errors/ApiError.js';

export class ContextController extends BaseApiController {
  public constructor(
    private readonly contextOrchestrator: IContextOrchestrator,
    private readonly sessionManager?: IAgentContextSessionManager | undefined
  ) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    const basePath = '/v1/workspaces/:workspaceId/repositories/:repositoryId/context';

    // Core Context Orchestrator endpoints
    router.post(`${basePath}/orchestrate`, this.orchestrateContext.bind(this));
    router.post(`${basePath}/plan`, this.getContextPlan.bind(this));
    router.post(`${basePath}/package`, this.getContextPackage.bind(this));
    router.post(`${basePath}/feature`, this.getFeatureContext.bind(this));
    router.post(`${basePath}/estimate`, this.estimateTokens.bind(this));
    router.post(`${basePath}/explain`, this.explainContext.bind(this));

    // Stateful Context Sessions (if sessionManager is configured)
    router.post(`${basePath}/sessions`, this.createSession.bind(this));
    router.get(`${basePath}/sessions/:sessionId`, this.getSession.bind(this));
    router.post(`${basePath}/sessions/:sessionId/bundle`, this.getContextBundle.bind(this));
    router.post(`${basePath}/sessions/:sessionId/refresh`, this.refreshSession.bind(this));
  }

  public async orchestrateContext(request: ApiRequest): Promise<ApiResponse> {
    const contextRequest = this.buildContextRequest(request);
    this.contextOrchestrator.validateContextRequest(contextRequest);
    const response = await this.contextOrchestrator.orchestrateContext(contextRequest);
    return this.ok(request, response);
  }

  public async getContextPlan(request: ApiRequest): Promise<ApiResponse> {
    const contextRequest = this.buildContextRequest(request);
    this.contextOrchestrator.validateContextRequest(contextRequest);
    const plan = await this.contextOrchestrator.getContextPlan(contextRequest);
    return this.ok(request, plan);
  }

  public async getContextPackage(request: ApiRequest): Promise<ApiResponse> {
    const contextRequest = this.buildContextRequest(request);
    this.contextOrchestrator.validateContextRequest(contextRequest);
    const pkg = await this.contextOrchestrator.getContextPackage(contextRequest);
    return this.ok(request, pkg);
  }

  public async getFeatureContext(request: ApiRequest): Promise<ApiResponse> {
    const contextRequest = this.buildContextRequest(request);
    this.contextOrchestrator.validateContextRequest(contextRequest);
    const result = await this.contextOrchestrator.getFeatureContextForTask(contextRequest);
    return this.ok(request, result);
  }

  public async estimateTokens(request: ApiRequest): Promise<ApiResponse> {
    const contextRequest = this.buildContextRequest(request);
    this.contextOrchestrator.validateContextRequest(contextRequest);
    const tokenCount = await this.contextOrchestrator.estimateContextTokens(contextRequest);
    return this.ok(request, { estimatedTokens: tokenCount });
  }

  public async explainContext(request: ApiRequest): Promise<ApiResponse> {
    const contextRequest = this.buildContextRequest(request);
    this.contextOrchestrator.validateContextRequest(contextRequest);
    const explanation = await this.contextOrchestrator.getContextExplanation(contextRequest);
    return this.ok(request, explanation);
  }

  public async createSession(request: ApiRequest): Promise<ApiResponse> {
    if (!this.sessionManager) {
      throw ApiError.notImplemented('Context session management is not enabled');
    }

    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const result = await this.sessionManager.createContextSession({
      agentSessionId: body.agentSessionId ?? `agent-sess-${Date.now()}`,
      workspaceId: workspaceId ?? '',
      repositoryId: repositoryId ?? '',
      taskText: body.taskText ?? body.query ?? '',
      taskIntent: body.intent ?? 'CONTEXT_ORCHESTRATION',
      featureIds: body.featureIds,
      tokenBudget: body.tokenBudget,
      metadata: body.metadata,
    });

    return this.created(
      request,
      result,
      `/v1/workspaces/${workspaceId}/repositories/${repositoryId}/context/sessions/${result.contextSession.contextSessionId}`
    );
  }

  public async getSession(request: ApiRequest): Promise<ApiResponse> {
    if (!this.sessionManager) {
      throw ApiError.notImplemented('Context session management is not enabled');
    }

    const { sessionId, workspaceId, repositoryId } = request.params;
    if (!sessionId) {
      throw ApiError.badRequest('sessionId parameter is required');
    }

    const session = await this.sessionManager.getContextSession(sessionId, {
      workspaceId,
      repositoryId,
    });
    if (!session) {
      throw ApiError.notFound(`Context session '${sessionId}' not found`);
    }

    return this.ok(request, session);
  }

  public async getContextBundle(request: ApiRequest): Promise<ApiResponse> {
    if (!this.sessionManager) {
      throw ApiError.notImplemented('Context session management is not enabled');
    }

    const { sessionId, workspaceId, repositoryId } = request.params;
    if (!sessionId) {
      throw ApiError.badRequest('sessionId parameter is required');
    }

    const body = (request.body as Record<string, any>) ?? {};
    const result = await this.sessionManager.getCurrentContext(
      sessionId,
      {
        includeDelta: body.includeDelta ?? false,
        baseContextVersion: body.baseContextVersion,
        autoRefreshIfStale: body.autoRefreshIfStale ?? true,
      },
      { workspaceId, repositoryId }
    );

    return this.ok(request, result);
  }

  public async refreshSession(request: ApiRequest): Promise<ApiResponse> {
    if (!this.sessionManager) {
      throw ApiError.notImplemented('Context session management is not enabled');
    }

    const { sessionId, workspaceId, repositoryId } = request.params;
    if (!sessionId) {
      throw ApiError.badRequest('sessionId parameter is required');
    }

    const body = (request.body as Record<string, any>) ?? {};
    const result = await this.sessionManager.refreshContextSession(
      sessionId,
      {
        reason: body.reason ?? 'MANUAL_API_TRIGGER',
        forceFullRefresh: body.force ?? false,
      },
      { workspaceId, repositoryId }
    );

    return this.ok(request, result);
  }

  private buildContextRequest(request: ApiRequest): ContextRequest {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const taskText = body.taskText ?? body.task ?? body.query ?? '';
    const projectId = body.projectId ?? request.params['projectId'] ?? request.context.securityContext?.projectId;

    return {
      workspaceId: workspaceId ?? request.context.securityContext?.workspaceId ?? '',
      projectId: projectId && projectId !== '*' ? projectId : undefined,
      repositoryId: repositoryId ?? '',
      taskText,
      query: taskText,
      featureIds: body.featureIds ?? (body.featureId ? [body.featureId] : undefined),
      resourceIds: body.resourceIds ?? body.files,
      changedResources: body.changedResources,
      tokenBudget: body.tokenBudget ?? body.budget,
      maxDepth: body.maxDepth ?? body.depth,
      compressionMode: body.compressionMode,
      explainSelection: body.explainSelection ?? body.explain,
      freshnessPolicy: body.freshnessPolicy,
      outputFormat: body.outputFormat,
      securityContext: request.context.securityContext,
    };
  }
}
