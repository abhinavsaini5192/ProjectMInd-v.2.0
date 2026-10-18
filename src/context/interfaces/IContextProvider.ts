import type { ContextPackage } from '../models/ContextPackage.js';
import type { ContextRequest } from '../models/ContextRequest.js';

export interface ResourceChangeContextRef {
  resourceId: string;
  repositoryId: string;
  workspaceId: string;
}

export interface IContextProvider {
  getContextForTask(task: string | ContextRequest): Promise<ContextPackage>;
  getContextForFeature(featureId: string, options?: Partial<ContextRequest>): Promise<ContextPackage>;
  getContextForChange(change: ResourceChangeContextRef): Promise<ContextPackage>;
  getContextForResources(
    resourceIds: string[],
    repositoryId: string,
    workspaceId: string
  ): Promise<ContextPackage>;
}
