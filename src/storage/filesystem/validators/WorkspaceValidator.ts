import type { WorkspacePointer } from '../models/WorkspacePointer';
import { WorkspaceType } from '../types/FilesystemTypes';

export class WorkspaceValidator {
  static isValidPointer(pointer: Partial<WorkspacePointer>): boolean {
    return !!(
      pointer &&
      typeof pointer.repositoryId === 'string' &&
      typeof pointer.workspaceVersion === 'string' &&
      pointer.workspaceType === WorkspaceType.Global
    );
  }
}
