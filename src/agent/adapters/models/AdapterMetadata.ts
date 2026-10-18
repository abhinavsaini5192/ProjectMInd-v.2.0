import type { AgentProvider } from './AgentProvider.js';
import type { AgentProtocol } from './AgentProtocol.js';
import type { AgentAdapterType } from './AgentAdapterType.js';
import type { AgentAdapterStatus } from './AgentAdapterStatus.js';
import type { AdapterCapability } from './AdapterCapability.js';
import type { AgentType } from '../../models/AgentType.js';

export interface AdapterLimits {
  readonly maxContextSizeBytes?: number | undefined;
  readonly maxToolCount?: number | undefined;
  readonly maxRequestSizeBytes?: number | undefined;
  readonly maxResponseSizeBytes?: number | undefined;
  readonly supportedContextFormats?: readonly string[] | undefined;
}

export interface AdapterMetadata {
  readonly adapterId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly provider: AgentProvider;
  readonly protocol: AgentProtocol;
  readonly protocolVersion: string;
  readonly adapterVersion: string;
  readonly type: AgentAdapterType;
  readonly status: AgentAdapterStatus;
  readonly capabilities: readonly AdapterCapability[];
  readonly supportedAgentType?: AgentType | undefined;
  readonly limits?: AdapterLimits | undefined;
  readonly createdAt: number;
}
