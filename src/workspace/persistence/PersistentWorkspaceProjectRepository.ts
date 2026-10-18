import type { IWorkspaceRepository } from './IWorkspaceRepository.js';
import type { IProjectRepository } from './IProjectRepository.js';
import type { Workspace, WorkspaceStatusType } from '../models/Workspace.js';
import type { WorkspaceMember } from '../models/WorkspaceMember.js';
import type { Project } from '../models/Project.js';
import type { ProjectStatusType } from '../models/ProjectStatus.js';
import type { ProjectRepositoryAssociation } from '../models/ProjectRepository.js';
import { StorageCoreError } from '../../storage/types/StorageErrors.js';

export class PersistentWorkspaceProjectRepository implements IWorkspaceRepository, IProjectRepository {
  private readonly workspaces = new Map<string, Workspace>();
  private readonly workspaceBySlug = new Map<string, string>(); // slug -> workspaceId
  private readonly members = new Map<string, WorkspaceMember>(); // `${workspaceId}:${principalId}` -> member

  private readonly projects = new Map<string, Project>();
  private readonly projectByWorkspaceAndSlug = new Map<string, string>(); // `${workspaceId}:${slug}` -> projectId
  private readonly projectRepositories = new Map<string, ProjectRepositoryAssociation[]>(); // projectId -> associations
  private readonly repositoryToProject = new Map<string, string>(); // repositoryId -> projectId

  // ================= Workspace Operations =================

  public async saveWorkspace(workspace: Workspace): Promise<void> {
    const existing = this.workspaces.get(workspace.workspaceId);
    if (existing && existing.version >= workspace.version) {
      throw new StorageCoreError(
        `Optimistic lock failure: Workspace '${workspace.workspaceId}' version ${workspace.version} is stale (current: ${existing.version})`
      );
    }

    // Check slug collision
    const existingSlugOwner = this.workspaceBySlug.get(workspace.slug);
    if (existingSlugOwner && existingSlugOwner !== workspace.workspaceId) {
      throw new StorageCoreError(
        `Workspace slug collision: '${workspace.slug}' is already taken by workspace '${existingSlugOwner}'`
      );
    }

    if (existing && existing.slug !== workspace.slug) {
      this.workspaceBySlug.delete(existing.slug);
    }

    this.workspaces.set(workspace.workspaceId, workspace);
    this.workspaceBySlug.set(workspace.slug, workspace.workspaceId);
  }

  public async getWorkspace(workspaceId: string): Promise<Workspace | undefined> {
    return this.workspaces.get(workspaceId);
  }

  public async getWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const id = this.workspaceBySlug.get(slug);
    return id ? this.workspaces.get(id) : undefined;
  }

  public async listWorkspaces(status?: WorkspaceStatusType): Promise<readonly Workspace[]> {
    const list = Array.from(this.workspaces.values());
    return status ? list.filter((w) => w.status === status) : list;
  }

  public async saveMember(member: WorkspaceMember): Promise<void> {
    const key = `${member.workspaceId}:${member.principalId}`;
    this.members.set(key, member);
  }

  public async getMember(workspaceId: string, principalId: string): Promise<WorkspaceMember | undefined> {
    const key = `${workspaceId}:${principalId}`;
    return this.members.get(key);
  }

  public async listMembers(workspaceId: string): Promise<readonly WorkspaceMember[]> {
    const result: WorkspaceMember[] = [];
    for (const [key, member] of this.members.entries()) {
      if (key.startsWith(`${workspaceId}:`)) {
        result.push(member);
      }
    }
    return result;
  }

  public async deleteMember(workspaceId: string, principalId: string): Promise<void> {
    const key = `${workspaceId}:${principalId}`;
    this.members.delete(key);
  }

  // ================= Project Operations =================

  public async saveProject(project: Project): Promise<void> {
    const existing = this.projects.get(project.projectId);
    if (existing && existing.version >= project.version) {
      throw new StorageCoreError(
        `Optimistic lock failure: Project '${project.projectId}' version ${project.version} is stale (current: ${existing.version})`
      );
    }

    // Slug collision within workspace
    const slugKey = `${project.workspaceId}:${project.slug}`;
    const existingSlugProject = this.projectByWorkspaceAndSlug.get(slugKey);
    if (existingSlugProject && existingSlugProject !== project.projectId) {
      throw new StorageCoreError(
        `Project slug collision: '${project.slug}' is already taken in workspace '${project.workspaceId}'`
      );
    }

    if (existing && existing.slug !== project.slug) {
      this.projectByWorkspaceAndSlug.delete(`${existing.workspaceId}:${existing.slug}`);
    }

    this.projects.set(project.projectId, project);
    this.projectByWorkspaceAndSlug.set(slugKey, project.projectId);
  }

  public async getProject(projectId: string): Promise<Project | undefined> {
    return this.projects.get(projectId);
  }

  public async getProjectBySlug(workspaceId: string, slug: string): Promise<Project | undefined> {
    const key = `${workspaceId}:${slug}`;
    const id = this.projectByWorkspaceAndSlug.get(key);
    return id ? this.projects.get(id) : undefined;
  }

  public async listProjects(workspaceId: string, status?: ProjectStatusType): Promise<readonly Project[]> {
    const list = Array.from(this.projects.values()).filter((p) => p.workspaceId === workspaceId);
    return status ? list.filter((p) => p.status === status) : list;
  }

  public async attachRepository(association: ProjectRepositoryAssociation): Promise<void> {
    const existingProjId = this.repositoryToProject.get(association.repositoryId);
    if (existingProjId && existingProjId !== association.projectId) {
      throw new StorageCoreError(
        `Repository conflict: Repository '${association.repositoryId}' is already attached to project '${existingProjId}'`
      );
    }

    const currentList = this.projectRepositories.get(association.projectId) ?? [];
    const filtered = currentList.filter((a) => a.repositoryId !== association.repositoryId);
    filtered.push(association);

    this.projectRepositories.set(association.projectId, filtered);
    this.repositoryToProject.set(association.repositoryId, association.projectId);

    // Update repositoryIds in project
    const project = this.projects.get(association.projectId);
    if (project) {
      const repoIds = Array.from(new Set([...project.repositoryIds, association.repositoryId]));
      const updatedProject: Project = {
        ...project,
        repositoryIds: repoIds,
        primaryRepositoryId: project.primaryRepositoryId ?? (association.isPrimary ? association.repositoryId : undefined),
        updatedAt: new Date().toISOString(),
        version: project.version + 1,
      };
      this.projects.set(project.projectId, updatedProject);
    }
  }

  public async detachRepository(projectId: string, repositoryId: string): Promise<void> {
    const currentList = this.projectRepositories.get(projectId) ?? [];
    const filtered = currentList.filter((a) => a.repositoryId !== repositoryId);
    this.projectRepositories.set(projectId, filtered);
    this.repositoryToProject.delete(repositoryId);

    const project = this.projects.get(projectId);
    if (project) {
      const repoIds = project.repositoryIds.filter((id) => id !== repositoryId);
      const updatedProject: Project = {
        ...project,
        repositoryIds: repoIds,
        primaryRepositoryId: project.primaryRepositoryId === repositoryId ? repoIds[0] : project.primaryRepositoryId,
        updatedAt: new Date().toISOString(),
        version: project.version + 1,
      };
      this.projects.set(projectId, updatedProject);
    }
  }

  public async listRepositoriesForProject(projectId: string): Promise<readonly ProjectRepositoryAssociation[]> {
    return this.projectRepositories.get(projectId) ?? [];
  }

  public async getProjectForRepository(repositoryId: string): Promise<string | undefined> {
    return this.repositoryToProject.get(repositoryId);
  }
}
