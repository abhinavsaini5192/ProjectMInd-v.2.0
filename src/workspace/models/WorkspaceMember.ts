export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MAINTAINER' | 'DEVELOPER' | 'VIEWER';

export type WorkspaceMemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface WorkspaceMember {
  readonly memberId: string;
  readonly workspaceId: string;
  readonly principalId: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceMemberStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AddWorkspaceMemberParams {
  readonly workspaceId: string;
  readonly principalId: string;
  readonly role: WorkspaceRole;
}
