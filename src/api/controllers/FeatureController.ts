import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureKnowledgeQuery } from '../../knowledge/features/api/models/FeatureKnowledgeQuery.js';
import { ApiError } from '../errors/ApiError.js';

export class FeatureController extends BaseApiController {
  public constructor(private readonly featureApi: IFeatureKnowledgeAPI) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    const basePath = '/v1/workspaces/:workspaceId/repositories/:repositoryId/features';

    router.get(basePath, this.listOrSearchFeatures.bind(this));
    router.post(`${basePath}/query`, this.queryFeatures.bind(this));
    router.post(`${basePath}/explain`, this.explainFeatures.bind(this));
    router.post(`${basePath}/completeness`, this.getCompleteness.bind(this));
    router.post(`${basePath}/freshness`, this.getFreshness.bind(this));
    router.post(`${basePath}/version-status`, this.getVersionStatus.bind(this));

    router.get(`${basePath}/:featureId`, this.getFeature.bind(this));
    router.get(`${basePath}/:featureId/summary`, this.getFeatureSummary.bind(this));
    router.get(`${basePath}/:featureId/context`, this.getFeatureContext.bind(this));
    router.get(`${basePath}/:featureId/mappings`, this.getFeatureMappings.bind(this));
    router.get(`${basePath}/:featureId/dependencies`, this.getFeatureDependencies.bind(this));
    router.get(`${basePath}/:featureId/dependents`, this.getFeatureDependents.bind(this));
    router.get(`${basePath}/:featureId/behavior`, this.getFeatureBehavior.bind(this));
    router.get(`${basePath}/:featureId/health`, this.getFeatureHealth.bind(this));
    router.get(`${basePath}/:featureId/impact`, this.getFeatureImpact.bind(this));
    router.get(`${basePath}/:featureId/history`, this.getFeatureHistory.bind(this));
    router.get(`${basePath}/:featureId/architecture`, this.getFeatureArchitecture.bind(this));
  }

  public async listOrSearchFeatures(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const query = request.query['q'] || request.query['query'] || '';

    const queryObj: FeatureKnowledgeQuery = {
      featureId: typeof query === 'string' ? query : '',
      workspaceId,
      repositoryId,
    };

    const response = await this.featureApi.getFeatureKnowledge(queryObj);
    return this.ok(request, response);
  }

  public async queryFeatures(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, unknown>) ?? {};

    const queryObj: FeatureKnowledgeQuery = {
      featureId: (body.featureId as string) ?? '',
      workspaceId,
      repositoryId,
      ...(body as Partial<FeatureKnowledgeQuery>),
    };

    const response = await this.featureApi.getFeatureKnowledge(queryObj);
    return this.ok(request, response);
  }

  public async getFeature(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const feature = await this.featureApi.getFeatureProfile(featureId);
    if (!feature) {
      throw ApiError.notFound(`Feature '${featureId}' not found`);
    }

    return this.ok(request, feature);
  }

  public async getFeatureSummary(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const summary = await this.featureApi.getFeatureSummary(featureId);
    return this.ok(request, summary);
  }

  public async getFeatureContext(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const contextPkg = await this.featureApi.getFeatureContext(featureId);
    return this.ok(request, contextPkg);
  }

  public async getFeatureMappings(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const mappings = await this.featureApi.getFeatureMappings(featureId);
    return this.ok(request, mappings);
  }

  public async getFeatureDependencies(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const dependencies = await this.featureApi.getFeatureDependencies(featureId);
    return this.ok(request, dependencies);
  }

  public async getFeatureDependents(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const dependents = await this.featureApi.getFeatureDependents(featureId);
    return this.ok(request, dependents);
  }

  public async getFeatureBehavior(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const behavior = await this.featureApi.getFeatureBehavior(featureId);
    return this.ok(request, behavior);
  }

  public async getFeatureHealth(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const health = await this.featureApi.getFeatureHealth(featureId);
    return this.ok(request, health);
  }

  public async getFeatureImpact(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const impact = await this.featureApi.getFeatureImpact(featureId);
    return this.ok(request, impact);
  }

  public async getFeatureHistory(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const history = await this.featureApi.getFeatureHistory(featureId);
    return this.ok(request, history);
  }

  public async getFeatureArchitecture(request: ApiRequest): Promise<ApiResponse> {
    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const arch = await this.featureApi.getFeatureArchitecture(featureId);
    return this.ok(request, arch);
  }

  public async explainFeatures(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const query: FeatureKnowledgeQuery = {
      featureId: body.featureId ?? '',
      workspaceId,
      repositoryId,
      ...body,
    };

    const explanation = await this.featureApi.explainFeatureKnowledge(query);
    return this.ok(request, explanation);
  }

  public async getCompleteness(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const query: FeatureKnowledgeQuery = {
      featureId: body.featureId ?? '',
      workspaceId,
      repositoryId,
      ...body,
    };

    const completeness = await this.featureApi.getKnowledgeCompleteness(query);
    return this.ok(request, completeness);
  }

  public async getFreshness(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const query: FeatureKnowledgeQuery = {
      featureId: body.featureId ?? '',
      workspaceId,
      repositoryId,
      ...body,
    };

    const freshness = await this.featureApi.getKnowledgeFreshness(query);
    return this.ok(request, freshness);
  }

  public async getVersionStatus(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const query: FeatureKnowledgeQuery = {
      featureId: body.featureId ?? '',
      workspaceId,
      repositoryId,
      ...body,
    };

    const versionStatus = await this.featureApi.getKnowledgeVersionStatus(query);
    return this.ok(request, versionStatus);
  }
}
