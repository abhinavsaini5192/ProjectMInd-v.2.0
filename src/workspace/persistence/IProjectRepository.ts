import type { Project } from '../models/Project.js';
import type { ProjectStatusType } from '../models/ProjectStatus.js';
import type { ProjectRepositoryAssociation } from '../models/ProjectRepository.js';

export interface IProjectRepository {
  saveProject(project: Project): Promise<void>;
  getProject(projectId: string): Promise<Project | undefined>;
  getProjectBySlug(workspaceId: string, slug: string): Promise<Project | undefined>;
  listProjects(workspaceId: string, status?: ProjectStatusType): Promise<readonly Project[]>;
  attachRepository(association: ProjectRepositoryAssociation): Promise<void>;
  detachRepository(projectId: string, repositoryId: string): Promise<void>;
  listRepositoriesForProject(projectId: string): Promise<readonly ProjectRepositoryAssociation[]>;
  getProjectForRepository(repositoryId: string): Promise<string | undefined>;
}
