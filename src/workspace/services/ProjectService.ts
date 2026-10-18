import type { IProjectService } from './IProjectService.js';
import type { IWorkspaceRepository } from '../persistence/IWorkspaceRepository.js';
import type { IProjectRepository } from '../persistence/IProjectRepository.js';
import type { Project, CreateProjectParams, UpdateProjectParams } from '../models/Project.js';
import { type ProjectStatusType, isValidProjectTransition } from '../models/ProjectStatus.js';
import type { ProjectRepositoryAssociation, AttachRepositoryParams } from '../models/ProjectRepository.js';
import type { ProjectContext, ResolveProjectContextParams } from '../models/ProjectContext.js';
import { DEFAULT_PROJECT_SETTINGS } from '../models/ProjectConfiguration.js';
import type { SecurityContext } from '../../security/models/SecurityContext.js';
import type { IEventBus } from '../interfaces/IEventBus.js';
import { WORKSPACE_PROJECT_EVENTS, type WorkspaceProjectEventPayload } from '../events/WorkspaceProjectEvents.js';
import { ProjectMindError } from '../../errors/index.js';
import { ScopeViolationError } from '../../security/errors/SecurityError.js';
import * as crypto from 'crypto';

export class ProjectService implements IProjectService {
  constructor(
    private readonly workspaceRepo: IWorkspaceRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async createProject(params: CreateProjectParams, securityContext?: SecurityContext): Promise<Project> {
    this.assertWorkspaceScope(params.workspaceId, securityContext);

    const workspace = await this.workspaceRepo.getWorkspace(params.workspaceId);
    if (!workspace) {
      throw new ProjectMindError(`Parent workspace '${params.workspaceId}' not found`, 'WORKSPACE_NOT_FOUND');
    }

    if (workspace.status !== 'ACTIVE') {
      throw new ProjectMindError(
        `Cannot create project in workspace '${params.workspaceId}' with status '${workspace.status}'. Workspace must be ACTIVE.`,
        'WORKSPACE_NOT_ACTIVE'
      );
    }

    const projectId = `proj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const slug = (params.slug ?? params.name)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const now = new Date().toISOString();

    const mergedSettings = {
      ...DEFAULT_PROJECT_SETTINGS,
      ...(params.settings ?? {}),
      analysis: { ...DEFAULT_PROJECT_SETTINGS.analysis, ...(params.settings?.analysis ?? {}) },
      context: { ...DEFAULT_PROJECT_SETTINGS.context, ...(params.settings?.context ?? {}) },
      features: { ...DEFAULT_PROJECT_SETTINGS.features, ...(params.settings?.features ?? {}) },
      agent: { ...DEFAULT_PROJECT_SETTINGS.agent, ...(params.settings?.agent ?? {}) },
      security: { ...DEFAULT_PROJECT_SETTINGS.security, ...(params.settings?.security ?? {}) },
    };

    const project: Project = {
      projectId,
      workspaceId: params.workspaceId,
      name: params.name,
      slug: slug || projectId,
      description: params.description,
      status: 'ACTIVE',
      projectType: params.projectType ?? 'SERVICE',
      settings: mergedSettings,
      primaryRepositoryId: params.primaryRepositoryId,
      repositoryIds: params.primaryRepositoryId ? [params.primaryRepositoryId] : [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.projectRepo.saveProject(project);

    // If primaryRepositoryId provided, bind it
    if (params.primaryRepositoryId) {
      await this.projectRepo.attachRepository({
        projectId,
        repositoryId: params.primaryRepositoryId,
        workspaceId: params.workspaceId,
        isPrimary: true,
        attachedAt: now,
        attachedBy: securityContext?.principal?.principalId ?? 'system',
      });
    }

    const finalProject = (await this.projectRepo.getProject(projectId)) ?? project;
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.PROJECT_CREATED, finalProject.workspaceId, finalProject.projectId, finalProject, securityContext);

    return finalProject;
  }

  public async getProject(projectId: string, securityContext?: SecurityContext): Promise<Project> {
    const project = await this.projectRepo.getProject(projectId);
    if (!project) {
      throw new ProjectMindError(`Project '${projectId}' not found`, 'PROJECT_NOT_FOUND');
    }

    this.assertProjectScope(project, securityContext);
    return project;
  }

  public async getProjectBySlug(workspaceId: string, slug: string, securityContext?: SecurityContext): Promise<Project> {
    this.assertWorkspaceScope(workspaceId, securityContext);

    const project = await this.projectRepo.getProjectBySlug(workspaceId, slug);
    if (!project) {
      throw new ProjectMindError(`Project with slug '${slug}' not found in workspace '${workspaceId}'`, 'PROJECT_NOT_FOUND');
    }

    this.assertProjectScope(project, securityContext);
    return project;
  }

  public async listProjects(workspaceId: string, status?: ProjectStatusType, securityContext?: SecurityContext): Promise<readonly Project[]> {
    this.assertWorkspaceScope(workspaceId, securityContext);

    const projects = await this.projectRepo.listProjects(workspaceId, status);

    if (!securityContext || securityContext.isGlobalAdmin?.()) {
      return projects;
    }

    // Filter by allowed projectId if explicitly scoped
    if (securityContext.projectId && securityContext.projectId !== '*') {
      return projects.filter((p) => p.projectId === securityContext.projectId);
    }

    return projects;
  }

  public async updateProject(projectId: string, params: UpdateProjectParams, securityContext?: SecurityContext): Promise<Project> {
    const current = await this.getProject(projectId, securityContext);

    if (current.status === 'ARCHIVED' || current.status === 'COMPLETED') {
      throw new ProjectMindError(
        `Cannot update project '${projectId}' in ${current.status} state. Restore project first.`,
        'INVALID_PROJECT_STATE'
      );
    }

    const updatedSettings = params.settings
      ? {
          ...current.settings,
          ...params.settings,
          analysis: { ...current.settings.analysis, ...(params.settings.analysis ?? {}) },
          context: { ...current.settings.context, ...(params.settings.context ?? {}) },
          features: { ...current.settings.features, ...(params.settings.features ?? {}) },
          agent: { ...current.settings.agent, ...(params.settings.agent ?? {}) },
          security: { ...current.settings.security, ...(params.settings.security ?? {}) },
        }
      : current.settings;

    const updated: Project = {
      ...current,
      name: params.name ?? current.name,
      description: params.description !== undefined ? params.description : current.description,
      primaryRepositoryId: params.primaryRepositoryId ?? current.primaryRepositoryId,
      settings: updatedSettings,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.projectRepo.saveProject(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.PROJECT_UPDATED, updated.workspaceId, projectId, updated, securityContext);

    return updated;
  }

  public async archiveProject(projectId: string, securityContext?: SecurityContext): Promise<Project> {
    const current = await this.getProject(projectId, securityContext);

    if (current.status === 'ARCHIVED') {
      return current;
    }

    if (!isValidProjectTransition(current.status, 'ARCHIVED')) {
      throw new ProjectMindError(`Invalid lifecycle transition from ${current.status} to ARCHIVED`, 'INVALID_LIFECYCLE_TRANSITION');
    }

    const updated: Project = {
      ...current,
      status: 'ARCHIVED',
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.projectRepo.saveProject(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.PROJECT_ARCHIVED, updated.workspaceId, projectId, updated, securityContext);

    return updated;
  }

  public async restoreProject(projectId: string, securityContext?: SecurityContext): Promise<Project> {
    const current = await this.getProject(projectId, securityContext);

    if (current.status === 'ACTIVE') {
      return current;
    }

    if (!isValidProjectTransition(current.status, 'ACTIVE')) {
      throw new ProjectMindError(`Invalid lifecycle transition from ${current.status} to ACTIVE`, 'INVALID_LIFECYCLE_TRANSITION');
    }

    const updated: Project = {
      ...current,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.projectRepo.saveProject(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.PROJECT_RESTORED, updated.workspaceId, projectId, updated, securityContext);

    return updated;
  }

  public async deleteProject(projectId: string, securityContext?: SecurityContext): Promise<void> {
    const project = await this.getProject(projectId, securityContext);

    // Archive project as safe soft-deletion
    await this.archiveProject(projectId, securityContext);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.PROJECT_DELETED, project.workspaceId, projectId, { projectId }, securityContext);
  }

  public async attachRepository(params: AttachRepositoryParams, securityContext?: SecurityContext): Promise<ProjectRepositoryAssociation> {
    const project = await this.getProject(params.projectId, securityContext);

    if (project.workspaceId !== params.workspaceId) {
      throw new ScopeViolationError(
        `Cross-workspace violation: Project '${params.projectId}' belongs to workspace '${project.workspaceId}', cannot attach to workspace '${params.workspaceId}'`
      );
    }

    const existingProjectId = await this.projectRepo.getProjectForRepository(params.repositoryId);
    if (existingProjectId && existingProjectId !== params.projectId) {
      throw new ProjectMindError(
        `Repository '${params.repositoryId}' is already bound to project '${existingProjectId}'. Reassignment must be explicit.`,
        'REPOSITORY_ATTACH_CONFLICT'
      );
    }

    const association: ProjectRepositoryAssociation = {
      projectId: params.projectId,
      repositoryId: params.repositoryId,
      workspaceId: params.workspaceId,
      repositoryPath: params.repositoryPath,
      isPrimary: params.isPrimary ?? (project.repositoryIds.length === 0),
      attachedAt: new Date().toISOString(),
      attachedBy: params.attachedBy ?? securityContext?.principal?.principalId ?? 'system',
    };

    await this.projectRepo.attachRepository(association);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.REPOSITORY_ATTACHED, params.workspaceId, params.projectId, association, securityContext);

    return association;
  }

  public async detachRepository(projectId: string, repositoryId: string, securityContext?: SecurityContext): Promise<void> {
    const project = await this.getProject(projectId, securityContext);

    await this.projectRepo.detachRepository(projectId, repositoryId);
    this.publishEvent(
      WORKSPACE_PROJECT_EVENTS.REPOSITORY_DETACHED,
      project.workspaceId,
      projectId,
      { projectId, repositoryId },
      securityContext
    );
  }

  public async listRepositories(projectId: string, securityContext?: SecurityContext): Promise<readonly ProjectRepositoryAssociation[]> {
    await this.getProject(projectId, securityContext);
    return this.projectRepo.listRepositoriesForProject(projectId);
  }

  public async initializeProject(projectId: string, securityContext?: SecurityContext): Promise<Project> {
    const current = await this.getProject(projectId, securityContext);

    const updated: Project = {
      ...current,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.projectRepo.saveProject(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.PROJECT_INITIALIZED, updated.workspaceId, projectId, updated, securityContext);

    return updated;
  }

  public async resolveProjectContext(params: ResolveProjectContextParams): Promise<ProjectContext> {
    let resolvedProjectId = params.explicitProjectId;
    let resolvedWorkspaceId = params.explicitWorkspaceId;
    let resolvedRepositoryId = params.explicitRepositoryId;
    let project: Project | undefined;

    // Step 1: Explicit project ID
    if (resolvedProjectId) {
      project = await this.projectRepo.getProject(resolvedProjectId);
      if (!project) {
        throw new ProjectMindError(`Explicit project '${resolvedProjectId}' not found`, 'PROJECT_NOT_FOUND');
      }
      resolvedWorkspaceId = project.workspaceId;
      resolvedRepositoryId = resolvedRepositoryId ?? project.primaryRepositoryId ?? project.repositoryIds[0] ?? 'primary';
    }

    // Step 2: Repository association
    if (!project && resolvedRepositoryId) {
      const boundProjectId = await this.projectRepo.getProjectForRepository(resolvedRepositoryId);
      if (boundProjectId) {
        project = await this.projectRepo.getProject(boundProjectId);
        if (project) {
          resolvedProjectId = project.projectId;
          resolvedWorkspaceId = project.workspaceId;
        }
      }
    }

    // Step 3: Workspace context lookup (if single project in workspace)
    if (!project && resolvedWorkspaceId) {
      const projectsInWorkspace = await this.projectRepo.listProjects(resolvedWorkspaceId, 'ACTIVE');
      if (projectsInWorkspace.length === 1) {
        project = projectsInWorkspace[0];
        resolvedProjectId = project?.projectId;
        resolvedRepositoryId = resolvedRepositoryId ?? project?.primaryRepositoryId ?? project?.repositoryIds[0] ?? 'primary';
      }
    }

    // Fallback default resolution if in unmanaged local repository
    if (!project) {
      resolvedWorkspaceId = resolvedWorkspaceId ?? 'default';
      resolvedProjectId = resolvedProjectId ?? `proj_default`;
      resolvedRepositoryId = resolvedRepositoryId ?? 'default';

      return {
        workspaceId: resolvedWorkspaceId,
        projectId: resolvedProjectId,
        repositoryId: resolvedRepositoryId,
        repositoryPath: params.repositoryPath,
        securityContext: params.securityContext,
        configurationVersion: 1,
        settings: DEFAULT_PROJECT_SETTINGS,
        knowledgeVersion: 1,
        correlationId: params.correlationId ?? `corr_${Date.now()}`,
        resolvedAt: new Date().toISOString(),
      };
    }

    return {
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      repositoryId: resolvedRepositoryId ?? project.primaryRepositoryId ?? 'primary',
      repositoryPath: params.repositoryPath,
      securityContext: params.securityContext,
      configurationVersion: project.version,
      settings: project.settings,
      knowledgeVersion: project.version,
      correlationId: params.correlationId ?? `corr_${Date.now()}`,
      resolvedAt: new Date().toISOString(),
    };
  }

  // ================= Scope Helpers =================

  private assertWorkspaceScope(workspaceId: string, securityContext?: SecurityContext): void {
    if (!securityContext) return;
    if (securityContext.isGlobalAdmin?.()) return;

    if (securityContext.workspaceId && securityContext.workspaceId !== '*' && securityContext.workspaceId !== workspaceId) {
      throw new ScopeViolationError(
        `Cross-workspace access violation: Target workspace '${workspaceId}' does not match authorized workspace '${securityContext.workspaceId}'`
      );
    }
  }

  private assertProjectScope(project: Project, securityContext?: SecurityContext): void {
    if (!securityContext) return;
    if (securityContext.isGlobalAdmin?.()) return;

    this.assertWorkspaceScope(project.workspaceId, securityContext);

    if (securityContext.projectId && securityContext.projectId !== '*' && securityContext.projectId !== project.projectId) {
      throw new ScopeViolationError(
        `Cross-project access violation: Target project '${project.projectId}' does not match authorized project '${securityContext.projectId}'`
      );
    }
  }

  private publishEvent<T>(eventName: string, workspaceId: string, projectId: string, data: T, securityContext?: SecurityContext): void {
    if (!this.eventBus) return;

    const payload: WorkspaceProjectEventPayload<T> = {
      eventId: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      eventName,
      scope: { workspaceId, projectId },
      timestamp: new Date().toISOString(),
      correlationId: securityContext?.sessionContext?.correlationId ?? `corr_${Date.now()}`,
      version: 1,
      principalId: securityContext?.principal?.principalId,
      data,
    };

    this.eventBus.publish(eventName, payload);
  }
}

export const IProjectServiceToken = Symbol('ProjectService');
