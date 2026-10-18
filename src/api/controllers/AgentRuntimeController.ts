import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IProductionAgentRuntime } from '../../agent/runtime/interfaces/IProductionAgentRuntime.js';
import type { ToolRequest } from '../../agent/protocol/models/ToolRequest.js';
import { ApiError } from '../errors/ApiError.js';

export class AgentRuntimeController extends BaseApiController {
  public constructor(private readonly runtime: IProductionAgentRuntime) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    // Runtime system metadata
    router.get('/v1/runtime/status', this.getStatus.bind(this));
    router.get('/v1/runtime/health', this.getHealth.bind(this));
    router.get('/v1/runtime/metrics', this.getMetrics.bind(this));
    router.get('/v1/runtime/capabilities', this.getCapabilities.bind(this));

    // Sessions
    router.post('/v1/runtime/sessions', this.createSession.bind(this));
    router.get('/v1/runtime/sessions', this.listSessions.bind(this));
    router.get('/v1/runtime/sessions/:sessionId', this.getSession.bind(this));
    router.delete('/v1/runtime/sessions/:sessionId', this.terminateSession.bind(this));

    // Tasks within sessions
    router.post('/v1/runtime/sessions/:sessionId/tasks', this.submitTask.bind(this));
    router.get('/v1/runtime/sessions/:sessionId/tasks/:taskId', this.getTask.bind(this));
    router.post('/v1/runtime/sessions/:sessionId/tasks/:taskId/execute', this.executeTool.bind(this));
    router.post('/v1/runtime/sessions/:sessionId/tasks/:taskId/complete', this.completeTask.bind(this));
    router.post('/v1/runtime/sessions/:sessionId/tasks/:taskId/cancel', this.cancelTask.bind(this));
  }

  public async getStatus(request: ApiRequest): Promise<ApiResponse> {
    const status = await this.runtime.getStatus();
    return this.ok(request, status);
  }

  public async getHealth(request: ApiRequest): Promise<ApiResponse> {
    const health = await this.runtime.getHealth();
    const statusCode = health.status === 'UNHEALTHY' ? 503 : 200;
    return {
      ...this.ok(request, health),
      status: statusCode,
    };
  }

  public async getMetrics(request: ApiRequest): Promise<ApiResponse> {
    const metrics = this.runtime.getMetrics();
    return this.ok(request, metrics);
  }

  public async getCapabilities(request: ApiRequest): Promise<ApiResponse> {
    const capabilities = this.runtime.getCapabilities();
    return this.ok(request, capabilities);
  }

  public async createSession(request: ApiRequest): Promise<ApiResponse> {
    const body = (request.body as Record<string, any>) ?? {};
    if (!body.agentId || !body.workspaceId) {
      throw ApiError.badRequest('agentId and workspaceId are required');
    }

    const agent = {
      agentId: body.agentId,
      name: body.agentName ?? body.agentId,
      version: body.agentVersion ?? '1.0.0',
      status: 'ACTIVE' as const,
      capabilities: body.capabilities ?? [],
      registeredAt: Date.now(),
      metadata: body.metadata,
    };

    const session = await this.runtime.createSession(
      {
        agentId: body.agentId,
        workspaceId: body.workspaceId,
        repositoryId: body.repositoryId ?? 'default-repo',
        branch: body.branch,
        commit: body.commit,
        requestedCapabilities: body.requestedCapabilities ?? body.capabilities,
        protocolVersion: body.protocolVersion,
        metadata: body.metadata,
      },
      agent as any
    );

    return this.created(request, session, `/v1/runtime/sessions/${session.sessionId}`);
  }

  public async listSessions(request: ApiRequest): Promise<ApiResponse> {
    const workspaceId = typeof request.query['workspaceId'] === 'string'
      ? request.query['workspaceId']
      : undefined;

    const sessions = await this.runtime.listActiveSessions(workspaceId);
    return this.ok(request, sessions);
  }

  public async getSession(request: ApiRequest): Promise<ApiResponse> {
    const { sessionId } = request.params;
    if (!sessionId) {
      throw ApiError.badRequest('sessionId parameter is required');
    }

    const session = await this.runtime.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session '${sessionId}' not found`);
    }

    return this.ok(request, session);
  }

  public async terminateSession(request: ApiRequest): Promise<ApiResponse> {
    const { sessionId } = request.params;
    if (!sessionId) {
      throw ApiError.badRequest('sessionId parameter is required');
    }

    await this.runtime.terminateSession(sessionId);
    return this.noContent(request);
  }

  public async submitTask(request: ApiRequest): Promise<ApiResponse> {
    const { sessionId } = request.params;
    if (!sessionId) {
      throw ApiError.badRequest('sessionId parameter is required');
    }

    const body = (request.body as Record<string, any>) ?? {};
    const session = await this.runtime.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session '${sessionId}' not found`);
    }

    const taskResult = await this.runtime.submitTask(
      {
        agentSessionId: sessionId,
        workspaceId: session.workspaceId,
        repositoryId: session.repositoryId,
        title: body.title ?? body.description ?? 'API Task',
        description: body.description ?? '',
        intent: body.intent,
        priority: body.priority,
        featureIds: body.featureIds,
        tokenBudget: body.tokenBudget,
        metadata: body.metadata,
      },
      {
        workspaceId: session.workspaceId,
        repositoryId: session.repositoryId,
        agentSessionId: sessionId,
      }
    );

    return this.created(
      request,
      taskResult,
      `/v1/runtime/sessions/${sessionId}/tasks/${taskResult.task.taskId}`
    );
  }

  public async getTask(request: ApiRequest): Promise<ApiResponse> {
    const { sessionId, taskId } = request.params;
    if (!sessionId || !taskId) {
      throw ApiError.badRequest('sessionId and taskId parameters are required');
    }

    const session = await this.runtime.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session '${sessionId}' not found`);
    }

    const task = await this.runtime.getTask(taskId, {
      workspaceId: session.workspaceId,
      repositoryId: session.repositoryId,
      agentSessionId: sessionId,
    });

    if (!task) {
      throw ApiError.notFound(`Task '${taskId}' not found`);
    }

    return this.ok(request, task);
  }

  public async executeTool(request: ApiRequest): Promise<ApiResponse> {
    const { sessionId, taskId } = request.params;
    if (!sessionId || !taskId) {
      throw ApiError.badRequest('sessionId and taskId parameters are required');
    }

    const body = (request.body as Record<string, any>) ?? {};
    if (!body.toolName) {
      throw ApiError.badRequest('toolName is required');
    }

    const session = await this.runtime.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session '${sessionId}' not found`);
    }

    const toolRequest: ToolRequest = {
      requestId: body.requestId ?? `tool-req-${Date.now()}`,
      toolName: body.toolName,
      agentId: session.agentId,
      sessionId,
      protocolVersion: body.protocolVersion ?? '1.0.0',
      arguments: body.arguments ?? {},
      workspaceId: session.workspaceId,
      repositoryId: session.repositoryId,
      timestamp: new Date().toISOString(),
      metadata: body.metadata,
    };

    const result = await this.runtime.executeTool(toolRequest, session);
    return this.ok(request, result);
  }

  public async completeTask(request: ApiRequest): Promise<ApiResponse> {
    const { sessionId, taskId } = request.params;
    if (!sessionId || !taskId) {
      throw ApiError.badRequest('sessionId and taskId parameters are required');
    }

    const body = (request.body as Record<string, any>) ?? {};
    const session = await this.runtime.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session '${sessionId}' not found`);
    }

    const task = await this.runtime.completeTask(
      {
        taskId,
        reason: body.reason ?? 'COMPLETED_VIA_API',
        expectedVersion: body.expectedVersion,
      },
      {
        workspaceId: session.workspaceId,
        repositoryId: session.repositoryId,
        agentSessionId: sessionId,
      }
    );

    return this.ok(request, task);
  }

  public async cancelTask(request: ApiRequest): Promise<ApiResponse> {
    const { sessionId, taskId } = request.params;
    if (!sessionId || !taskId) {
      throw ApiError.badRequest('sessionId and taskId parameters are required');
    }

    const body = (request.body as Record<string, any>) ?? {};
    const session = await this.runtime.getSession(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session '${sessionId}' not found`);
    }

    const task = await this.runtime.cancelTask(
      {
        taskId,
        reason: body.reason ?? 'CANCELED_BY_API',
        expectedVersion: body.expectedVersion,
      },
      {
        workspaceId: session.workspaceId,
        repositoryId: session.repositoryId,
        agentSessionId: sessionId,
      }
    );

    return this.ok(request, task);
  }
}
