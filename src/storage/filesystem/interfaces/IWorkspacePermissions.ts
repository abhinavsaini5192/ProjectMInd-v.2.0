import type { WorkspacePermissions } from '../models/WorkspacePermissions';

export interface IWorkspacePermissions {
  checkPermissions(path: string): Promise<WorkspacePermissions>;
  hasReadAccess(path: string): Promise<boolean>;
  hasWriteAccess(path: string): Promise<boolean>;
  ensureWriteAccess(path: string): Promise<void>;
}

export const IWorkspacePermissionsToken = Symbol('IWorkspacePermissions');
