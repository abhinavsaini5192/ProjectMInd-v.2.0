import type { IWorkspaceFilesystem } from './interfaces/IWorkspaceFilesystem';
import type { IWorkspaceDirectoryManager } from './interfaces/IWorkspaceDirectoryManager';
import type { IWorkspaceFileManager } from './interfaces/IWorkspaceFileManager';
import type { IWorkspacePointerManager } from './interfaces/IWorkspacePointerManager';
import type { IWorkspacePermissions } from './interfaces/IWorkspacePermissions';
import type { IWorkspaceTemplateManager } from './interfaces/IWorkspaceTemplateManager';
import { WorkspaceLockManager } from './WorkspaceLockManager';
import { WorkspaceCleanupManager } from './WorkspaceCleanupManager';
import { PathResolver } from './utils/PathResolver';

export class WorkspaceFilesystem implements IWorkspaceFilesystem {
  constructor(
    public directories: IWorkspaceDirectoryManager,
    public files: IWorkspaceFileManager,
    public pointers: IWorkspacePointerManager,
    public permissions: IWorkspacePermissions,
    public templates: IWorkspaceTemplateManager,
    public locks: WorkspaceLockManager,
    public cleanup: WorkspaceCleanupManager
  ) {}

  getGlobalWorkspacePath(): string {
    return PathResolver.getGlobalWorkspaceRoot();
  }

  getRepositoryWorkspacePath(repositoryId: string): string {
    return PathResolver.getRepositoryWorkspacePath(repositoryId);
  }
}
