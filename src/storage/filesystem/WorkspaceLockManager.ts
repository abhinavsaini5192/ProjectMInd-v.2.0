import * as fs from 'fs/promises';
import * as path from 'path';
import { LockType } from './types/FilesystemTypes';
import type { WorkspaceLock } from './models/WorkspaceLock';
import { LockTimeoutError } from './types/FilesystemErrors';
import type { IWorkspaceFileManager } from './interfaces/IWorkspaceFileManager';

export class WorkspaceLockManager {
  private readonly LOCK_TIMEOUT_MS = 30000;

  constructor(private fileManager: IWorkspaceFileManager) {}

  async acquireLock(workspacePath: string, type: LockType): Promise<WorkspaceLock> {
    const lockPath = path.join(workspacePath, '.lock');
    
    if (await this.fileManager.fileExists(lockPath)) {
      const existing = await this.fileManager.readJson<WorkspaceLock>(lockPath);
      if (Date.now() < new Date(existing.expiresAt).getTime()) {
        throw new LockTimeoutError(`Workspace is locked by PID ${existing.pid}`);
      }
      // Stale lock, we can overwrite
    }

    const lock: WorkspaceLock = {
      id: crypto.randomUUID(),
      type,
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.LOCK_TIMEOUT_MS).toISOString()
    };

    await this.fileManager.writeJson(lockPath, lock, true);
    return lock;
  }

  async releaseLock(workspacePath: string, lockId: string): Promise<void> {
    const lockPath = path.join(workspacePath, '.lock');
    if (await this.fileManager.fileExists(lockPath)) {
      const existing = await this.fileManager.readJson<WorkspaceLock>(lockPath);
      if (existing.id === lockId) {
        await this.fileManager.deleteFile(lockPath);
      }
    }
  }
}
