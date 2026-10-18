import type { Project, CreateProjectParams, UpdateProjectParams } from '../models/Project.js';
import type { ProjectStatusType } from '../models/ProjectStatus.js';
import type { ProjectRepositoryAssociation, AttachRepositoryParams } from '../models/ProjectRepository.js';
import type { ProjectContext, ResolveProjectContextParams } from '../models/ProjectContext.js';
import type { SecurityContext } from '../../security/models/SecurityContext.js';

export interface IProjectService {
  createProject(params: CreateProjectParams, securityContext?: SecurityContext): Promise<Project>;
  getProject(projectId: string, securityContext?: SecurityContext): Promise<Project>;
  getProjectBySlug(workspaceId: string, slug: string, securityContext?: SecurityContext): Promise<Project>;
  listProjects(workspaceId: string, status?: ProjectStatusType, securityContext?: SecurityContext): Promise<readonly Project[]>;
  updateProject(projectId: string, params: UpdateProjectParams, securityContext?: SecurityContext): Promise<Project>;
  archiveProject(projectId: string, securityContext?: SecurityContext): Promise<Project>;
  restoreProject(projectId: string, securityContext?: SecurityContext): Promise<Project>;
  deleteProject(projectId: string, securityContext?: SecurityContext): Promise<void>;

  attachRepository(params: AttachRepositoryParams, securityContext?: SecurityContext): Promise<ProjectRepositoryAssociation>;
  detachRepository(projectId: string, repositoryId: string, securityContext?: SecurityContext): Promise<void>;
  listRepositories(projectId: string, securityContext?: SecurityContext): Promise<readonly ProjectRepositoryAssociation[]>;

  initializeProject(projectId: string, securityContext?: SecurityContext): Promise<Project>;
  resolveProjectContext(params: ResolveProjectContextParams): Promise<ProjectContext>;
}
