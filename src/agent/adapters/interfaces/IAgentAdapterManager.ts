import type { IAgentAdapter } from './IAgentAdapter.js';
import type { IAgentAdapterRegistry } from './IAgentAdapterRegistry.js';
import type { IAgentAdapterResolver, AdapterResolutionCriteria } from './IAgentAdapterResolver.js';
import type { AdapterRequest } from '../models/AdapterRequest.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';

export interface IAgentAdapterManager {
  readonly registry: IAgentAdapterRegistry;
  readonly resolver: IAgentAdapterResolver;

  registerAdapter(adapter: IAgentAdapter): Promise<void>;
  unregisterAdapter(adapterId: string): Promise<boolean>;
  getAdapter(adapterId: string): IAgentAdapter | undefined;
  resolveAdapter(criteria: AdapterResolutionCriteria): IAgentAdapter;
  processRequest(criteria: AdapterResolutionCriteria, rawRequest: unknown): Promise<AdapterResponse>;
  shutdownAll(): Promise<void>;
}
