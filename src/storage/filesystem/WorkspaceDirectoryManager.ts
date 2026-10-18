import * as fs from 'fs/promises';
import * as path from 'path';
import type { IWorkspaceDirectoryManager } from './interfaces/IWorkspaceDirectoryManager';
import type { WorkspaceDirectory } from './models/WorkspaceDirectory';
import { DirectoryOperationError } from './types/FilesystemErrors';
import { FilesystemValidator } from './validators/FilesystemValidator';

export class WorkspaceDirectoryManager implements IWorkspaceDirectoryManager {
  async ensureDirectory(dirPath: string): Promise<WorkspaceDirectory> {
    if (!FilesystemValidator.isValidPath(dirPath)) {
      throw new DirectoryOperationError(`Invalid path: ${dirPath}`);
    }

    try {
      await fs.mkdir(dirPath, { recursive: true });
      const stat = await fs.stat(dirPath);
      return {
        path: dirPath,
        exists: true,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString()
      };
    } catch (error: any) {
      throw new DirectoryOperationError(`Failed to create directory: ${dirPath}`, { error: error.message });
    }
  }

  async createStructure(basePath: string, layout: readonly string[]): Promise<void> {
    for (const folder of layout) {
      const fullPath = path.join(basePath, folder);
      await this.ensureDirectory(fullPath);
    }
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error: any) {
      throw new DirectoryOperationError(`Failed to delete directory: ${dirPath}`, { error: error.message });
    }
  }

  async moveDirectory(source: string, destination: string): Promise<void> {
    try {
      await fs.rename(source, destination);
    } catch (error: any) {
      throw new DirectoryOperationError(`Failed to move directory from ${source} to ${destination}`, { error: error.message });
    }
  }

  async renameDirectory(dirPath: string, newName: string): Promise<void> {
    const parent = path.dirname(dirPath);
    const destination = path.join(parent, newName);
    return this.moveDirectory(dirPath, destination);
  }

  async validateStructure(basePath: string, layout: readonly string[]): Promise<boolean> {
    try {
      for (const folder of layout) {
        const fullPath = path.join(basePath, folder);
        const stat = await fs.stat(fullPath);
        if (!stat.isDirectory()) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async calculateSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          size += await this.calculateSize(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          size += stat.size;
        }
      }
    } catch (error) {
      // Ignore errors on size calc for missing dirs
    }
    return size;
  }
}
