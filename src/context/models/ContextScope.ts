export interface ContextScope {
  repositoryId: string;
  workspaceId: string;
  branch?: string | undefined;
  snapshotId?: string | undefined;
  baseDirectory?: string | undefined;
}
