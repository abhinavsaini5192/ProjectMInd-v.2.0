import type { IAgentAdapter } from './IAgentAdapter.js';
import type { AgentProvider } from '../models/AgentProvider.js';
import type { AgentProtocol } from '../models/AgentProtocol.js';
import type { AgentType } from '../../models/AgentType.js';

export interface IAgentAdapterRegistry {
  register(adapter: IAgentAdapter): void;
  unregister(id: string): boolean;
  get(id: string): IAgentAdapter | undefined;
  getByProvider(provider: AgentProvider): IAgentAdapter[];
  getByProtocol(protocol: AgentProtocol): IAgentAdapter[];
  getByAgentType(type: AgentType): IAgentAdapter[];
  list(): IAgentAdapter[];
  has(id: string): boolean;
  clear(): void;
}
