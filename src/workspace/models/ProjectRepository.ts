export interface ProjectRepositoryAssociation {
  readonly projectId: string;
  readonly repositoryId: string;
  readonly workspaceId: string;
  readonly repositoryPath?: string | undefined;
  readonly isPrimary: boolean;
  readonly attachedAt: string;
  readonly attachedBy?: string | undefined;
}

export interface AttachRepositoryParams {
  readonly projectId: string;
  readonly repositoryId: string;
  readonly workspaceId: string;
  readonly repositoryPath?: string | undefined;
  readonly isPrimary?: boolean | undefined;
  readonly attachedBy?: string | undefined;
}
