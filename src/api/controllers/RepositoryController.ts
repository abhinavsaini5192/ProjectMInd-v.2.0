import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import { ApiError } from '../errors/ApiError.js';

export class RepositoryController extends BaseApiController {
  public registerRoutes(router: IApiRouter): void {
    const basePath = '/v1/workspaces/:workspaceId/repositories/:repositoryId';
    router.get(basePath, this.getRepository.bind(this));
    router.get(`${basePath}/state`, this.getRepositoryState.bind(this));
    router.get(`${basePath}/architecture`, this.getRepositoryArchitecture.bind(this));
  }

  public async getRepository(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    if (!workspaceId || !repositoryId) {
      throw ApiError.badRequest('workspaceId and repositoryId are required');
    }

    return this.ok(request, {
      workspaceId,
      repositoryId,
      name: repositoryId,
      status: 'READY',
      defaultBranch: 'main',
    });
  }

  public async getRepositoryState(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    if (!workspaceId || !repositoryId) {
      throw ApiError.badRequest('workspaceId and repositoryId are required');
    }

    return this.ok(request, {
      workspaceId,
      repositoryId,
      phase: '8.3',
      status: 'PRODUCTION_API_READY',
      updatedAt: new Date().toISOString(),
    });
  }

  public async getRepositoryArchitecture(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    if (!workspaceId || !repositoryId) {
      throw ApiError.badRequest('workspaceId and repositoryId are required');
    }

    return this.ok(request, {
      workspaceId,
      repositoryId,
      architecture: 'AI-native project memory and repository intelligence platform',
      layers: [
        'Transport & API Layer (Phase 8.3)',
        'Security & Identity Foundation (Phase 8.2)',
        'Production Platform & Deployment (Phase 8.1)',
        'Knowledge & Update System (Phase 7)',
        'Feature Knowledge System (Phase 6)',
        'Context Orchestration (Phase 5)',
        'Agent Runtime (Phase 4)',
        'Graph & Memory Storage (Phases 1-3)',
      ],
    });
  }
}
