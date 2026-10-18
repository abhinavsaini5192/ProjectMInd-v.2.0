import type { WorkspacePointer } from '../models/WorkspacePointer';

export interface IWorkspacePointerManager {
  readPointer(repositoryPath: string): Promise<WorkspacePointer | null>;
  writePointer(repositoryPath: string, pointer: WorkspacePointer): Promise<void>;
  validatePointer(pointer: WorkspacePointer): boolean;
  isPointerInitialized(repositoryPath: string): Promise<boolean>;
}

export const IWorkspacePointerManagerToken = Symbol('IWorkspacePointerManager');
