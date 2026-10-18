export interface WorkspaceIdentity {
  readonly workspaceId: string;
  readonly name?: string | undefined;
  readonly ownerId?: string | undefined;
  readonly status: 'ACTIVE' | 'ARCHIVED' | 'DISABLED';
  readonly createdAt: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface RepositoryIdentity {
  readonly repositoryId: string;
  readonly workspaceId: string;
  readonly name?: string | undefined;
  readonly defaultBranch?: string | undefined;
  readonly status: 'ACTIVE' | 'ARCHIVED' | 'DISABLED';
  readonly createdAt: string;
  readonly metadata?: Record<string, unknown> | undefined;
}
