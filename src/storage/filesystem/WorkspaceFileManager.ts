import * as fs from 'fs/promises';
import * as path from 'path';
import type { IWorkspaceFileManager } from './interfaces/IWorkspaceFileManager';
import { FileOperationError } from './types/FilesystemErrors';
import { FilesystemUtils } from './utils/FilesystemUtils';

export class WorkspaceFileManager implements IWorkspaceFileManager {
  async readText(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error: any) {
      throw new FileOperationError(`Failed to read file: ${filePath}`, { error: error.message });
    }
  }

  async writeText(filePath: string, data: string, atomic: boolean = true): Promise<void> {
    try {
      if (atomic) {
        const tempPath = path.join(path.dirname(filePath), FilesystemUtils.getSafeTempFileName('.atomic_write'));
        await fs.writeFile(tempPath, data, 'utf8');
        await fs.rename(tempPath, filePath);
      } else {
        await fs.writeFile(filePath, data, 'utf8');
      }
    } catch (error: any) {
      throw new FileOperationError(`Failed to write file: ${filePath}`, { error: error.message });
    }
  }

  async readJson<T>(filePath: string): Promise<T> {
    const text = await this.readText(filePath);
    try {
      return JSON.parse(text) as T;
    } catch (error: any) {
      throw new FileOperationError(`Failed to parse JSON in file: ${filePath}`, { error: error.message });
    }
  }

  async writeJson<T>(filePath: string, data: T, atomic: boolean = true): Promise<void> {
    const text = JSON.stringify(data, null, 2);
    await this.writeText(filePath, text, atomic);
  }

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      await fs.copyFile(source, destination);
    } catch (error: any) {
      throw new FileOperationError(`Failed to copy file from ${source} to ${destination}`, { error: error.message });
    }
  }

  async moveFile(source: string, destination: string): Promise<void> {
    try {
      await fs.rename(source, destination);
    } catch (error: any) {
      throw new FileOperationError(`Failed to move file from ${source} to ${destination}`, { error: error.message });
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      // If it doesn't exist, we don't care
      if (error.code !== 'ENOENT') {
        throw new FileOperationError(`Failed to delete file: ${filePath}`, { error: error.message });
      }
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
