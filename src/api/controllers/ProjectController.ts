import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import { ApiError } from '../errors/ApiError.js';
import type { IProjectService } from '../../workspace/services/IProjectService.js';
import { ProjectService } from '../../workspace/services/ProjectService.js';
import { PersistentWorkspaceProjectRepository } from '../../workspace/persistence/PersistentWorkspaceProjectRepository.js';

export class ProjectController extends BaseApiController {
  private readonly projectService: IProjectService;

  constructor(projectService?: IProjectService) {
    super();
    const repo = new PersistentWorkspaceProjectRepository();
    this.projectService = projectService ?? new ProjectService(repo, repo);
  }

  public registerRoutes(router: IApiRouter): void {
    router.get('/v1/workspaces/:workspaceId/projects', this.listProjects.bind(this));
    router.post('/v1/workspaces/:workspaceId/projects', this.createProject.bind(this));
    router.get('/v1/projects/:projectId', this.getProject.bind(this));
    router.patch('/v1/projects/:projectId', this.updateProject.bind(this));
    router.post('/v1/projects/:projectId/archive', this.archiveProject.bind(this));
    router.post('/v1/projects/:projectId/restore', this.restoreProject.bind(this));
    router.post('/v1/projects/:projectId/init', this.initializeProject.bind(this));

    router.get('/v1/projects/:projectId/repositories', this.listRepositories.bind(this));
    router.post('/v1/projects/:projectId/repositories', this.attachRepository.bind(this));
    router.delete('/v1/projects/:projectId/repositories/:repositoryId', this.detachRepository.bind(this));

    router.get('/v1/projects/:projectId/context', this.resolveContext.bind(this));
  }

  public async listProjects(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId } = request.params;
    if (!workspaceId) {
      throw ApiError.badRequest('workspaceId is required');
    }

    const projects = await this.projectService.listProjects(workspaceId, undefined, request.context.securityContext);
    return this.ok(request, projects);
  }

  public async createProject(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId } = request.params;
    const body = request.body as any;

    if (!workspaceId || !body?.name) {
      throw ApiError.badRequest('workspaceId and name are required');
    }

    const project = await this.projectService.createProject(
      {
        workspaceId,
        name: body.name,
        slug: body.slug,
        description: body.description,
        projectType: body.projectType,
        primaryRepositoryId: body.primaryRepositoryId,
        settings: body.settings,
      },
      request.context.securityContext
    );

    return this.created(request, project);
  }

  public async getProject(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    if (!projectId) {
      throw ApiError.badRequest('projectId is required');
    }

    const project = await this.projectService.getProject(projectId, request.context.securityContext);
    return this.ok(request, project);
  }

  public async updateProject(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    if (!projectId) {
      throw ApiError.badRequest('projectId is required');
    }

    const body = request.body as any;
    const updated = await this.projectService.updateProject(
      projectId,
      {
        name: body?.name,
        description: body?.description,
        primaryRepositoryId: body?.primaryRepositoryId,
        settings: body?.settings,
      },
      request.context.securityContext
    );

    return this.ok(request, updated);
  }

  public async archiveProject(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    if (!projectId) {
      throw ApiError.badRequest('projectId is required');
    }

    const archived = await this.projectService.archiveProject(projectId, request.context.securityContext);
    return this.ok(request, archived);
  }

  public async restoreProject(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    if (!projectId) {
      throw ApiError.badRequest('projectId is required');
    }

    const restored = await this.projectService.restoreProject(projectId, request.context.securityContext);
    return this.ok(request, restored);
  }

  public async initializeProject(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    if (!projectId) {
      throw ApiError.badRequest('projectId is required');
    }

    const initialized = await this.projectService.initializeProject(projectId, request.context.securityContext);
    return this.ok(request, initialized);
  }

  public async listRepositories(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    if (!projectId) {
      throw ApiError.badRequest('projectId is required');
    }

    const repos = await this.projectService.listRepositories(projectId, request.context.securityContext);
    return this.ok(request, repos);
  }

  public async attachRepository(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    const body = request.body as any;

    if (!projectId || !body?.repositoryId || !body?.workspaceId) {
      throw ApiError.badRequest('projectId, repositoryId, and workspaceId are required');
    }

    const association = await this.projectService.attachRepository(
      {
        projectId,
        repositoryId: body.repositoryId,
        workspaceId: body.workspaceId,
        repositoryPath: body.repositoryPath,
        isPrimary: body.isPrimary,
      },
      request.context.securityContext
    );

    return this.created(request, association);
  }

  public async detachRepository(request: ApiRequest): Promise<ApiResponse> {
    const { projectId, repositoryId } = request.params;
    if (!projectId || !repositoryId) {
      throw ApiError.badRequest('projectId and repositoryId are required');
    }

    await this.projectService.detachRepository(projectId, repositoryId, request.context.securityContext);
    return this.noContent(request);
  }

  public async resolveContext(request: ApiRequest): Promise<ApiResponse> {
    const { projectId } = request.params;
    const ctx = await this.projectService.resolveProjectContext({
      explicitProjectId: projectId,
      securityContext: request.context.securityContext,
    });

    return this.ok(request, ctx);
  }
}
