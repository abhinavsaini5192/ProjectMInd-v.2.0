import type { IWorkspacePointerManager } from './interfaces/IWorkspacePointerManager';
import type { IWorkspaceFileManager } from './interfaces/IWorkspaceFileManager';
import type { WorkspacePointer } from './models/WorkspacePointer';
import { PointerFileError } from './types/FilesystemErrors';
import { WorkspaceValidator } from './validators/WorkspaceValidator';
import { PathResolver } from './utils/PathResolver';

export class WorkspacePointerManager implements IWorkspacePointerManager {
  constructor(private fileManager: IWorkspaceFileManager) {}

  async readPointer(repositoryPath: string): Promise<WorkspacePointer | null> {
    const pointerPath = PathResolver.getPointerFilePath(repositoryPath);
    if (!(await this.fileManager.fileExists(pointerPath))) {
      return null;
    }

    try {
      const data = await this.fileManager.readJson<WorkspacePointer>(pointerPath);
      if (!this.validatePointer(data)) {
        throw new PointerFileError('Invalid pointer file format.');
      }
      return data;
    } catch (error: any) {
      throw new PointerFileError(`Failed to read pointer in ${repositoryPath}`, { error: error.message });
    }
  }

  async writePointer(repositoryPath: string, pointer: WorkspacePointer): Promise<void> {
    if (!this.validatePointer(pointer)) {
      throw new PointerFileError('Cannot write invalid pointer.');
    }
    const pointerPath = PathResolver.getPointerFilePath(repositoryPath);
    await this.fileManager.writeJson(pointerPath, pointer, true);
  }

  validatePointer(pointer: WorkspacePointer): boolean {
    return WorkspaceValidator.isValidPointer(pointer);
  }

  async isPointerInitialized(repositoryPath: string): Promise<boolean> {
    const pointerPath = PathResolver.getPointerFilePath(repositoryPath);
    return this.fileManager.fileExists(pointerPath);
  }
}
