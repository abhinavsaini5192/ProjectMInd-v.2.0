export interface JobSecurityContext {
  readonly principalId: string;
  readonly workspaceId: string;
  readonly repositoryId?: string | undefined;
  readonly roles?: readonly string[] | undefined;
  readonly permissions?: readonly string[] | undefined;
}
