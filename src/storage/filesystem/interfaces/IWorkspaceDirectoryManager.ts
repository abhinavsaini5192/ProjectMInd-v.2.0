import type { WorkspaceDirectory } from '../models/WorkspaceDirectory';

export interface IWorkspaceDirectoryManager {
  ensureDirectory(path: string): Promise<WorkspaceDirectory>;
  createStructure(basePath: string, layout: readonly string[]): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  moveDirectory(source: string, destination: string): Promise<void>;
  renameDirectory(path: string, newName: string): Promise<void>;
  validateStructure(basePath: string, layout: readonly string[]): Promise<boolean>;
  calculateSize(path: string): Promise<number>;
}

export const IWorkspaceDirectoryManagerToken = Symbol('IWorkspaceDirectoryManager');
