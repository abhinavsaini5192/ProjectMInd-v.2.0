import { StorageCoreError } from '../types/StorageErrors.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export interface ScopedEntity {
  readonly id: string;
  readonly workspaceId: string;
  readonly repositoryId?: string | undefined;
}

export class WorkspaceIsolationRepository {
  private readonly repositoryToWorkspace = new Map<string, string>(); // repositoryId -> workspaceId

  constructor(private readonly logger?: ILogger | undefined) {}

  public registerRepositoryScope(repositoryId: string, workspaceId: string): void {
    if (this.repositoryToWorkspace.has(repositoryId)) {
      const existing = this.repositoryToWorkspace.get(repositoryId);
      if (existing !== workspaceId) {
        throw new StorageCoreError(
          `Security violation: Attempted to reassign repository '${repositoryId}' from workspace '${existing}' to '${workspaceId}'`
        );
      }
    }
    this.repositoryToWorkspace.set(repositoryId, workspaceId);
  }

  public getWorkspaceForRepository(repositoryId: string): string | undefined {
    return this.repositoryToWorkspace.get(repositoryId);
  }

  public validateWriteScope(entity: ScopedEntity, currentWorkspaceId: string): void {
    if (entity.workspaceId !== currentWorkspaceId) {
      this.logger?.error?.({
        component: 'WorkspaceIsolationRepository',
        operation: 'validateWriteScope',
        message: `Cross-workspace write rejected: Entity workspace '${entity.workspaceId}' does not match context workspace '${currentWorkspaceId}'`,
        details: { entityId: entity.id, targetWorkspace: entity.workspaceId, callerWorkspace: currentWorkspaceId },
      });
      throw new StorageCoreError(
        `Cross-workspace isolation violation: Entity '${entity.id}' belongs to workspace '${entity.workspaceId}', but write was attempted in workspace '${currentWorkspaceId}'`
      );
    }

    if (entity.repositoryId) {
      const boundWorkspace = this.repositoryToWorkspace.get(entity.repositoryId);
      if (boundWorkspace && boundWorkspace !== entity.workspaceId) {
        throw new StorageCoreError(
          `Repository isolation violation: Repository '${entity.repositoryId}' is bound to workspace '${boundWorkspace}', but entity specifies '${entity.workspaceId}'`
        );
      }
    }
  }

  public validateReadScope(entity: ScopedEntity, currentWorkspaceId: string): boolean {
    if (entity.workspaceId !== currentWorkspaceId) {
      this.logger?.warn?.({
        component: 'WorkspaceIsolationRepository',
        operation: 'validateReadScope',
        message: `Cross-workspace read attempt blocked: Entity '${entity.id}' belongs to '${entity.workspaceId}', requested by '${currentWorkspaceId}'`,
      });
      return false;
    }
    return true;
  }
}
