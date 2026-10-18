import type { AdapterMetadata } from '../models/AdapterMetadata.js';
import type { AdapterError } from '../models/AdapterError.js';

export const AGENT_ADAPTER_EVENTS = {
  REGISTERED: 'agent.adapter.registered',
  RESOLVED: 'agent.adapter.resolved',
  REQUEST_TRANSLATED: 'agent.adapter.request_translated',
  RESPONSE_TRANSLATED: 'agent.adapter.response_translated',
  ERROR_OCCURRED: 'agent.adapter.error',
} as const;

export interface AgentAdapterRegisteredEvent {
  readonly eventName: typeof AGENT_ADAPTER_EVENTS.REGISTERED;
  readonly adapter: AdapterMetadata;
  readonly timestamp: number;
}

export interface AgentAdapterResolvedEvent {
  readonly eventName: typeof AGENT_ADAPTER_EVENTS.RESOLVED;
  readonly adapterId: string;
  readonly provider: string;
  readonly protocol: string;
  readonly timestamp: number;
}

export interface AgentAdapterRequestTranslatedEvent {
  readonly eventName: typeof AGENT_ADAPTER_EVENTS.REQUEST_TRANSLATED;
  readonly adapterId: string;
  readonly requestId: string;
  readonly operation: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly timestamp: number;
}

export interface AgentAdapterResponseTranslatedEvent {
  readonly eventName: typeof AGENT_ADAPTER_EVENTS.RESPONSE_TRANSLATED;
  readonly adapterId: string;
  readonly requestId: string;
  readonly status: string;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface AgentAdapterErrorOccurredEvent {
  readonly eventName: typeof AGENT_ADAPTER_EVENTS.ERROR_OCCURRED;
  readonly adapterId: string;
  readonly requestId?: string | undefined;
  readonly error: AdapterError;
  readonly timestamp: number;
}
