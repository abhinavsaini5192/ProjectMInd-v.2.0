import type { IAgentAdapter as ILegacyAgentAdapter } from '../interfaces/IAgentAdapter.js';
import type { AgentType } from '../models/AgentType.js';
import type { IAgentAdapter } from './interfaces/IAgentAdapter.js';
import { AgentAdapterRegistry } from './core/AgentAdapterRegistry.js';

export interface IAdapterRegistry {
  register(adapter: ILegacyAgentAdapter | IAgentAdapter): void;
  get(id: string): ILegacyAgentAdapter | IAgentAdapter | undefined;
  getByAgentType(type: AgentType): (ILegacyAgentAdapter | IAgentAdapter)[];
  list(): (ILegacyAgentAdapter | IAgentAdapter)[];
}

/**
 * AdapterRegistry bridge maintaining full backward compatibility
 * with Phase 7.1 while extending the Phase 7.9 AgentAdapterRegistry.
 */
export class AdapterRegistry extends AgentAdapterRegistry implements IAdapterRegistry {
  public override register(adapter: ILegacyAgentAdapter | IAgentAdapter): void {
    super.register(adapter as IAgentAdapter);
  }
}
