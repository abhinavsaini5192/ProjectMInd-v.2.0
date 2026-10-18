import type { ProjectStatusType } from './ProjectStatus.js';
import type { ProjectSettings } from './ProjectConfiguration.js';

export type ProjectType =
  | 'SERVICE'
  | 'APPLICATION'
  | 'LIBRARY'
  | 'MONOREPO'
  | 'MULTI_REPO'
  | 'INFRASTRUCTURE'
  | 'RESEARCH';

export interface Project {
  readonly projectId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | undefined;
  readonly status: ProjectStatusType;
  readonly projectType: ProjectType;
  readonly settings: ProjectSettings;
  readonly primaryRepositoryId?: string | undefined;
  readonly repositoryIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CreateProjectParams {
  readonly workspaceId: string;
  readonly name: string;
  readonly slug?: string | undefined;
  readonly description?: string | undefined;
  readonly projectType?: ProjectType | undefined;
  readonly primaryRepositoryId?: string | undefined;
  readonly settings?: Partial<ProjectSettings> | undefined;
}

export interface UpdateProjectParams {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly primaryRepositoryId?: string | undefined;
  readonly settings?: Partial<ProjectSettings> | undefined;
}
