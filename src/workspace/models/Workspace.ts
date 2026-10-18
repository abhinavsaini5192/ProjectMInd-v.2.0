export type WorkspaceStatusType = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'DELETED' | 'UNKNOWN';

export interface WorkspaceSettings {
  readonly maxProjects?: number | undefined;
  readonly defaultRetentionDays?: number | undefined;
  readonly defaultContextLimit?: number | undefined;
  readonly allowedProjectTypes?: readonly string[] | undefined;
  readonly requireMfa?: boolean | undefined;
  readonly tags?: Readonly<Record<string, string>> | undefined;
}

export interface Workspace {
  readonly workspaceId: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | undefined;
  readonly status: WorkspaceStatusType;
  readonly ownerId: string;
  readonly settings: WorkspaceSettings;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CreateWorkspaceParams {
  readonly name: string;
  readonly slug?: string | undefined;
  readonly description?: string | undefined;
  readonly ownerId?: string | undefined;
  readonly settings?: WorkspaceSettings | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface UpdateWorkspaceParams {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly settings?: Partial<WorkspaceSettings> | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
