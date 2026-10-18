import * as fs from 'fs/promises';
import type { IWorkspacePermissions } from './interfaces/IWorkspacePermissions';
import type { WorkspacePermissions as PermModel } from './models/WorkspacePermissions';
import { PermissionDeniedError } from './types/FilesystemErrors';

export class WorkspacePermissions implements IWorkspacePermissions {
  async checkPermissions(targetPath: string): Promise<PermModel> {
    const perms: PermModel = {
      canRead: false,
      canWrite: false,
      canExecute: false,
      isOwner: true, // Assuming true for local desktop app context
      hasSufficientSpace: true
    };

    try {
      await fs.access(targetPath, fs.constants.R_OK);
      perms.canRead = true;
    } catch { }

    try {
      await fs.access(targetPath, fs.constants.W_OK);
      perms.canWrite = true;
    } catch { }

    try {
      await fs.access(targetPath, fs.constants.X_OK);
      perms.canExecute = true;
    } catch { }

    return perms;
  }

  async hasReadAccess(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async hasWriteAccess(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  async ensureWriteAccess(targetPath: string): Promise<void> {
    const hasWrite = await this.hasWriteAccess(targetPath);
    if (!hasWrite) {
      throw new PermissionDeniedError(`Missing write access to: ${targetPath}`);
    }
  }
}
