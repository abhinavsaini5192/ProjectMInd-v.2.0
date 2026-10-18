import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IRetrievalEngine } from '../../retrieval/interfaces/IRetrievalEngine.js';
import type { SemanticQuery } from '../../retrieval/models/SemanticQuery.js';
import { ApiError } from '../errors/ApiError.js';

export class SearchController extends BaseApiController {
  constructor(private readonly retrievalEngine: IRetrievalEngine) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    router.post('/search', this.handleSearch.bind(this));
  }

  private async handleSearch(request: ApiRequest): Promise<ApiResponse<any>> {
    const body = (request.body as Record<string, any>) ?? {};
    const text = body['text'] ?? body['query'];

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw ApiError.badRequest('Field "text" or "query" is required for search.');
    }

    const workspaceId = body['workspaceId'] ?? request.context.workspaceId;
    if (!workspaceId) {
      throw ApiError.badRequest('Field "workspaceId" is required for search.');
    }

    const repositoryId = body['repositoryId'] ?? 'default';
    const projectId = body['projectId'] ?? (request.context as any).projectId;

    // Security scope enforcement
    const sec = (request.context as any).security ?? (request.context as any).securityContext;
    if (sec && typeof sec.isGlobalAdmin === 'function' && !sec.isGlobalAdmin()) {
      if (sec.workspaceId && sec.workspaceId !== '*' && sec.workspaceId !== workspaceId) {
        throw ApiError.invalidScope(`Cross-workspace search forbidden: ${workspaceId}`);
      }
      if (sec.projectId && sec.projectId !== '*' && projectId && sec.projectId !== projectId) {
        throw ApiError.invalidScope(`Cross-project search forbidden: ${projectId}`);
      }
    }

    const query: SemanticQuery = {
      queryId: `api_search_${Date.now()}`,
      workspaceId,
      projectId,
      repositoryId,
      text,
      queryType: body['queryType'] ?? 'UNKNOWN',
      taskIntent: body['taskIntent'],
      targetFeatures: body['targetFeatures'],
      targetResources: body['targetResources'],
      filters: {
        limit: body['limit'] ?? 10,
        minScore: body['minScore'] ?? 0.15,
        sources: body['sources'],
        resourceTypes: body['resourceTypes'],
      },
      budget: body['budget'],
      timestamp: Date.now(),
      securityScope: sec,
    };

    const results = await this.retrievalEngine.retrieve(query);

    return this.ok(request, {
      query: text,
      count: results.length,
      results,
    });
  }
}
