import type { IAgentAdapter } from './IAgentAdapter.js';
import type { AgentProvider } from '../models/AgentProvider.js';
import type { AgentProtocol } from '../models/AgentProtocol.js';
import type { AdapterCapability } from '../models/AdapterCapability.js';

export interface AdapterResolutionCriteria {
  readonly adapterId?: string | undefined;
  readonly provider?: AgentProvider | undefined;
  readonly protocol?: AgentProtocol | undefined;
  readonly protocolVersion?: string | undefined;
  readonly requiredCapabilities?: readonly AdapterCapability[] | undefined;
  readonly preferredFormat?: string | undefined;
}

export interface IAgentAdapterResolver {
  resolve(criteria: AdapterResolutionCriteria): IAgentAdapter;
  resolveOptional(criteria: AdapterResolutionCriteria): IAgentAdapter | undefined;
}
