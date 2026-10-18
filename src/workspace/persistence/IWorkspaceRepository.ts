import type { Workspace, WorkspaceStatusType } from '../models/Workspace.js';
import type { WorkspaceMember } from '../models/WorkspaceMember.js';

export interface IWorkspaceRepository {
  saveWorkspace(workspace: Workspace): Promise<void>;
  getWorkspace(workspaceId: string): Promise<Workspace | undefined>;
  getWorkspaceBySlug(slug: string): Promise<Workspace | undefined>;
  listWorkspaces(status?: WorkspaceStatusType): Promise<readonly Workspace[]>;
  saveMember(member: WorkspaceMember): Promise<void>;
  getMember(workspaceId: string, principalId: string): Promise<WorkspaceMember | undefined>;
  listMembers(workspaceId: string): Promise<readonly WorkspaceMember[]>;
  deleteMember(workspaceId: string, principalId: string): Promise<void>;
}
