import type { IWorkspaceDirectoryManager } from './IWorkspaceDirectoryManager';
import type { IWorkspaceFileManager } from './IWorkspaceFileManager';
import type { IWorkspacePointerManager } from './IWorkspacePointerManager';
import type { IWorkspacePermissions } from './IWorkspacePermissions';
import type { IWorkspaceTemplateManager } from './IWorkspaceTemplateManager';

export interface IWorkspaceFilesystem {
  directories: IWorkspaceDirectoryManager;
  files: IWorkspaceFileManager;
  pointers: IWorkspacePointerManager;
  permissions: IWorkspacePermissions;
  templates: IWorkspaceTemplateManager;
  
  getGlobalWorkspacePath(): string;
  getRepositoryWorkspacePath(repositoryId: string): string;
}

export const IWorkspaceFilesystemToken = Symbol('IWorkspaceFilesystem');
