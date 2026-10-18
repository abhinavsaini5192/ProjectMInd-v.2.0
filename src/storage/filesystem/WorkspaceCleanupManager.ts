import type { IWorkspaceDirectoryManager } from './interfaces/IWorkspaceDirectoryManager';
import type { IWorkspaceFileManager } from './interfaces/IWorkspaceFileManager';
import * as path from 'path';

export class WorkspaceCleanupManager {
  constructor(
    private dirManager: IWorkspaceDirectoryManager,
    private fileManager: IWorkspaceFileManager
  ) {}

  async cleanupTempFiles(workspacePath: string): Promise<void> {
    const tempDir = path.join(workspacePath, 'temp');
    await this.dirManager.deleteDirectory(tempDir);
    await this.dirManager.ensureDirectory(tempDir);
  }

  async cleanupOrphanLocks(workspacePath: string): Promise<void> {
    const lockPath = path.join(workspacePath, '.lock');
    if (await this.fileManager.fileExists(lockPath)) {
      const lockData = await this.fileManager.readJson<any>(lockPath);
      if (Date.now() > new Date(lockData.expiresAt).getTime()) {
        await this.fileManager.deleteFile(lockPath);
      }
    }
  }
}
