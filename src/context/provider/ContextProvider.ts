import type { IContextProvider, ResourceChangeContextRef } from '../interfaces/IContextProvider.js';
import type { IContextOrchestrator } from '../interfaces/IContextOrchestrator.js';
import type { ContextPackage } from '../models/ContextPackage.js';
import type { ContextRequest } from '../models/ContextRequest.js';

export class ContextProvider implements IContextProvider {
  constructor(private readonly orchestrator: IContextOrchestrator) {}

  public async getContextForTask(task: string | ContextRequest): Promise<ContextPackage> {
    const req: ContextRequest =
      typeof task === 'string'
        ? {
            taskText: task,
            repositoryId: 'default',
            workspaceId: 'default',
          }
        : task;

    return this.orchestrator.getContextPackage(req);
  }

  public async getContextForFeature(
    featureId: string,
    options?: Partial<ContextRequest>
  ): Promise<ContextPackage> {
    const req: ContextRequest = {
      featureIds: [featureId],
      repositoryId: options?.repositoryId ?? 'default',
      workspaceId: options?.workspaceId ?? 'default',
      ...options,
    };

    return this.orchestrator.getContextPackage(req);
  }

  public async getContextForChange(change: ResourceChangeContextRef): Promise<ContextPackage> {
    const req: ContextRequest = {
      changedResources: [change.resourceId],
      repositoryId: change.repositoryId,
      workspaceId: change.workspaceId,
    };

    return this.orchestrator.getContextPackage(req);
  }

  public async getContextForResources(
    resourceIds: string[],
    repositoryId: string,
    workspaceId: string
  ): Promise<ContextPackage> {
    const req: ContextRequest = {
      resourceIds,
      repositoryId,
      workspaceId,
    };

    return this.orchestrator.getContextPackage(req);
  }
}
