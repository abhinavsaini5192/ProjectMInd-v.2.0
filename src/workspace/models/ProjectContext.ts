import type { SecurityContext } from '../../security/models/SecurityContext.js';
import type { ProjectSettings } from './ProjectConfiguration.js';

export interface ProjectContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryId: string;
  readonly repositoryPath?: string | undefined;
  readonly securityContext?: SecurityContext | undefined;
  readonly configurationVersion: number;
  readonly settings: ProjectSettings;
  readonly knowledgeVersion: string | number;
  readonly correlationId: string;
  readonly resolvedAt: string;
}

export interface ResolveProjectContextParams {
  readonly explicitWorkspaceId?: string | undefined;
  readonly explicitProjectId?: string | undefined;
  readonly explicitRepositoryId?: string | undefined;
  readonly repositoryPath?: string | undefined;
  readonly securityContext?: SecurityContext | undefined;
  readonly correlationId?: string | undefined;
}
