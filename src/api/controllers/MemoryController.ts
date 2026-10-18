import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IProjectMemoryManager } from '../../memory/project/interfaces/IProjectMemoryManager.js';
import type { IProjectMemoryStore } from '../../memory/project/interfaces/IProjectMemoryStore.js';
import { ApiError } from '../errors/ApiError.js';

export class MemoryController extends BaseApiController {
  constructor(
    private readonly memoryManager: IProjectMemoryManager,
    private readonly memoryStore: IProjectMemoryStore
  ) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    router.get('/memory', this.handleListMemories.bind(this));
    router.post('/memory/candidates', this.handleProposeCandidate.bind(this));
    router.get('/memory/candidates', this.handleListCandidates.bind(this));
    router.post('/memory/candidates/:id/promote', this.handlePromoteCandidate.bind(this));
    router.post('/memory/candidates/:id/reject', this.handleRejectCandidate.bind(this));
    router.get('/memory/:id', this.handleGetMemory.bind(this));
  }

  private async handleListMemories(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = request.query['workspaceId'] ?? request.context.workspaceId;
    const projectId = request.query['projectId'] ?? (request.context as any).projectId;
    const repositoryId = request.query['repositoryId'] ?? request.context.repositoryId;

    this.checkScope(request, workspaceId, projectId);

    const memories = await this.memoryManager.queryMemories({
      workspaceId,
      projectId,
      repositoryId,
      status: ['ACTIVE'],
    });

    return this.ok(request, { count: memories.length, memories });
  }

  private async handleGetMemory(request: ApiRequest): Promise<ApiResponse<any>> {
    const memoryId = request.params['id'];
    if (!memoryId) {
      throw ApiError.badRequest('Parameter "id" is required.');
    }

    const memory = await this.memoryStore.get(memoryId);
    if (!memory) {
      throw ApiError.notFound(`Memory '${memoryId}' not found.`);
    }

    this.checkScope(request, memory.workspaceId, memory.projectId);

    return this.ok(request, memory);
  }

  private async handleProposeCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const body = (request.body as Record<string, any>) ?? {};
    if (!body['title'] || !body['content'] || !body['type']) {
      throw ApiError.badRequest('Fields "title", "content", and "type" are required.');
    }

    const workspaceId = body['workspaceId'] ?? request.context.workspaceId;
    const projectId = body['projectId'] ?? (request.context as any).projectId;
    const repositoryId = body['repositoryId'] ?? request.context.repositoryId ?? 'default';

    this.checkScope(request, workspaceId, projectId);

    const candidate = await this.memoryManager.proposeCandidate({
      workspaceId,
      projectId,
      repositoryId,
      type: body['type'],
      title: body['title'],
      content: body['content'],
      structuredData: body['structuredData'],
      source: body['source'] ?? 'API',
      provenance: body['provenance'] ?? 'AGENT',
      confidence: body['confidence'] ?? 0.8,
      authority: body['authority'] ?? 'NON_AUTHORITATIVE',
      evidence: body['evidence'] ?? [],
      relatedResources: body['relatedResources'] ?? [],
      relatedFeatures: body['relatedFeatures'] ?? [],
      relatedTasks: body['relatedTasks'] ?? [],
    });

    return this.created(request, candidate, `/memory/candidates/${candidate.candidateId}`);
  }

  private async handleListCandidates(request: ApiRequest): Promise<ApiResponse<any>> {
    const repositoryId = request.query['repositoryId'] ?? 'default';
    const projectId = request.query['projectId'] ?? (request.context as any).projectId;

    const candidates = await this.memoryStore.listCandidates(repositoryId, projectId);
    return this.ok(request, { count: candidates.length, candidates });
  }

  private async handlePromoteCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const candidateId = request.params['id'];
    if (!candidateId) {
      throw ApiError.badRequest('Parameter "id" is required.');
    }

    const body = (request.body as Record<string, any>) ?? {};
    const overrideAuthority = body['authority'];

    const promoted = await this.memoryManager.promoteCandidate(candidateId, overrideAuthority);
    return this.ok(request, promoted);
  }

  private async handleRejectCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const candidateId = request.params['id'];
    if (!candidateId) {
      throw ApiError.badRequest('Parameter "id" is required.');
    }

    const body = (request.body as Record<string, any>) ?? {};
    const reason = body['reason'] ?? 'Rejected via API';

    const rejected = await this.memoryManager.rejectCandidate(candidateId, reason);
    return this.ok(request, { candidateId, rejected });
  }

  private checkScope(request: ApiRequest, workspaceId?: string, projectId?: string): void {
    const sec = (request.context as any).security ?? (request.context as any).securityContext;
    if (sec && typeof sec.isGlobalAdmin === 'function' && !sec.isGlobalAdmin()) {
      if (sec.workspaceId && sec.workspaceId !== '*' && workspaceId && sec.workspaceId !== workspaceId) {
        throw ApiError.invalidScope(`Workspace scope violation: ${workspaceId}`);
      }
      if (sec.projectId && sec.projectId !== '*' && projectId && sec.projectId !== projectId) {
        throw ApiError.invalidScope(`Project scope violation: ${projectId}`);
      }
    }
  }
}
