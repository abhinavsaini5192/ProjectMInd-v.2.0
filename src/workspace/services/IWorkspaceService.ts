import type { Workspace, WorkspaceStatusType, CreateWorkspaceParams, UpdateWorkspaceParams } from '../models/Workspace.js';
import type { WorkspaceMember, AddWorkspaceMemberParams } from '../models/WorkspaceMember.js';
import type { SecurityContext } from '../../security/models/SecurityContext.js';

export interface IWorkspaceService {
  createWorkspace(params: CreateWorkspaceParams, securityContext?: SecurityContext): Promise<Workspace>;
  getWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<Workspace>;
  getWorkspaceBySlug(slug: string, securityContext?: SecurityContext): Promise<Workspace>;
  listWorkspaces(status?: WorkspaceStatusType, securityContext?: SecurityContext): Promise<readonly Workspace[]>;
  updateWorkspace(workspaceId: string, params: UpdateWorkspaceParams, securityContext?: SecurityContext): Promise<Workspace>;
  archiveWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<Workspace>;
  restoreWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<Workspace>;
  deleteWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<void>;

  addMember(params: AddWorkspaceMemberParams, securityContext?: SecurityContext): Promise<WorkspaceMember>;
  removeMember(workspaceId: string, principalId: string, securityContext?: SecurityContext): Promise<void>;
  listMembers(workspaceId: string, securityContext?: SecurityContext): Promise<readonly WorkspaceMember[]>;
}
