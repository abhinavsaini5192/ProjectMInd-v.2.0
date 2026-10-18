import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IKnowledgeUpdateCoordinator } from '../../knowledge/update/interfaces/IKnowledgeUpdateCoordinator.js';
import { ApiError } from '../errors/ApiError.js';

export class KnowledgeUpdateController extends BaseApiController {
  public constructor(
    private readonly coordinator: IKnowledgeUpdateCoordinator
  ) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    const basePath = '/v1/workspaces/:workspaceId/repositories/:repositoryId/knowledge-updates';

    router.post(`${basePath}`, this.processUpdate.bind(this));
    router.post(`${basePath}/batch`, this.processBatchUpdates.bind(this));
    router.post(`${basePath}/plan`, this.planUpdate.bind(this));
    router.get(`${basePath}/pending`, this.getPendingUpdates.bind(this));
    router.get(`${basePath}/version`, this.getKnowledgeVersion.bind(this));
    router.get(`${basePath}/runs/:runId`, this.getUpdateRun.bind(this));
    router.get(`${basePath}/:updateId`, this.getUpdate.bind(this));
    router.get(`${basePath}/:updateId/status`, this.getUpdateStatus.bind(this));
    router.get(`${basePath}/:updateId/invalidations`, this.getInvalidations.bind(this));
    router.get(`${basePath}/:updateId/refresh-decisions`, this.getRefreshDecisions.bind(this));
    router.get(`${basePath}/:updateId/explanation`, this.explainUpdate.bind(this));
    router.post(`${basePath}/:updateId/retry`, this.retryUpdate.bind(this));
  }

  public async processUpdate(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const params = {
      workspaceId,
      repositoryId,
      ...body,
    } as any;

    const result = await this.coordinator.processKnowledgeUpdate(params);
    return this.created(
      request,
      result,
      `/v1/workspaces/${workspaceId}/repositories/${repositoryId}/knowledge-updates/${result.updateId}`
    );
  }

  public async processBatchUpdates(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};
    const items = Array.isArray(body.updates) ? body.updates : [];

    const paramsList = items.map((item: any) => ({
      workspaceId,
      repositoryId,
      ...item,
    }));

    const run = await this.coordinator.processKnowledgeUpdates(paramsList);
    return this.ok(request, run);
  }

  public async planUpdate(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const params = {
      workspaceId,
      repositoryId,
      ...body,
    } as any;

    const plan = await this.coordinator.planKnowledgeUpdate(params);
    return this.ok(request, plan);
  }

  public async getUpdate(request: ApiRequest): Promise<ApiResponse> {
    const { updateId } = request.params;
    if (!updateId) {
      throw ApiError.badRequest('updateId parameter is required');
    }

    const update = await this.coordinator.getKnowledgeUpdate(updateId);
    if (!update) {
      throw ApiError.notFound(`Knowledge update '${updateId}' not found`);
    }

    return this.ok(request, update);
  }

  public async getUpdateRun(request: ApiRequest): Promise<ApiResponse> {
    const { runId } = request.params;
    if (!runId) {
      throw ApiError.badRequest('runId parameter is required');
    }

    const run = await this.coordinator.getKnowledgeUpdateRun(runId);
    if (!run) {
      throw ApiError.notFound(`Knowledge update run '${runId}' not found`);
    }

    return this.ok(request, run);
  }

  public async getUpdateStatus(request: ApiRequest): Promise<ApiResponse> {
    const { updateId } = request.params;
    if (!updateId) {
      throw ApiError.badRequest('updateId parameter is required');
    }

    const status = await this.coordinator.getKnowledgeUpdateStatus(updateId);
    if (!status) {
      throw ApiError.notFound(`Knowledge update '${updateId}' not found`);
    }

    return this.ok(request, status);
  }

  public async getKnowledgeVersion(request: ApiRequest): Promise<ApiResponse> {
    const { repositoryId } = request.params;
    if (!repositoryId) {
      throw ApiError.badRequest('repositoryId parameter is required');
    }

    const version = await this.coordinator.getKnowledgeVersion(repositoryId);
    if (!version) {
      throw ApiError.notFound(`Knowledge version for repository '${repositoryId}' not found`);
    }

    return this.ok(request, version);
  }

  public async getPendingUpdates(request: ApiRequest): Promise<ApiResponse> {
    const { repositoryId } = request.params;
    if (!repositoryId) {
      throw ApiError.badRequest('repositoryId parameter is required');
    }

    const pending = await this.coordinator.getPendingKnowledgeUpdates(repositoryId);
    return this.ok(request, pending);
  }

  public async retryUpdate(request: ApiRequest): Promise<ApiResponse> {
    const { updateId } = request.params;
    if (!updateId) {
      throw ApiError.badRequest('updateId parameter is required');
    }

    const result = await this.coordinator.retryKnowledgeUpdate(updateId);
    return this.ok(request, result);
  }

  public async getInvalidations(request: ApiRequest): Promise<ApiResponse> {
    const { updateId } = request.params;
    if (!updateId) {
      throw ApiError.badRequest('updateId parameter is required');
    }

    const invalidations = await this.coordinator.getKnowledgeInvalidations(updateId);
    return this.ok(request, invalidations);
  }

  public async getRefreshDecisions(request: ApiRequest): Promise<ApiResponse> {
    const { updateId } = request.params;
    if (!updateId) {
      throw ApiError.badRequest('updateId parameter is required');
    }

    const decisions = await this.coordinator.getRefreshDecisions(updateId);
    return this.ok(request, decisions);
  }

  public async explainUpdate(request: ApiRequest): Promise<ApiResponse> {
    const { updateId } = request.params;
    if (!updateId) {
      throw ApiError.badRequest('updateId parameter is required');
    }

    const explanation = await this.coordinator.explainKnowledgeUpdate(updateId);
    return this.ok(request, { updateId, explanation });
  }
}
