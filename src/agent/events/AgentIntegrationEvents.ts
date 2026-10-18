import type { Agent } from '../models/Agent.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentResponse } from '../models/AgentResponse.js';
import type { AgentStatus } from '../models/AgentStatus.js';
import type { AgentCapabilitySet } from '../models/AgentCapabilitySet.js';

export const AgentIntegrationEvents = {
  AGENT_REGISTERED: 'agent.registered',
  AGENT_DEREGISTERED: 'agent.deregistered',
  AGENT_STATUS_CHANGED: 'agent.status.changed',
  AGENT_CAPABILITY_CHANGED: 'agent.capability.changed',
  AGENT_SESSION_CREATED: 'agent.session.created',
  AGENT_SESSION_CLOSED: 'agent.session.closed',
  AGENT_REQUEST_RECEIVED: 'agent.request.received',
  AGENT_REQUEST_COMPLETED: 'agent.request.completed',
  AGENT_REQUEST_FAILED: 'agent.request.failed',
} as const;

export type AgentIntegrationEventName =
  (typeof AgentIntegrationEvents)[keyof typeof AgentIntegrationEvents];

export interface AgentRegisteredPayload {
  readonly agent: Agent;
  readonly timestamp: string;
}

export interface AgentDeregisteredPayload {
  readonly agentId: string;
  readonly timestamp: string;
}

export interface AgentStatusChangedPayload {
  readonly agentId: string;
  readonly previousStatus: AgentStatus;
  readonly newStatus: AgentStatus;
  readonly timestamp: string;
}

export interface AgentCapabilityChangedPayload {
  readonly agentId: string;
  readonly capabilities: AgentCapabilitySet;
  readonly timestamp: string;
}

export interface AgentSessionCreatedPayload {
  readonly session: AgentSession;
  readonly timestamp: string;
}

export interface AgentSessionClosedPayload {
  readonly sessionId: string;
  readonly agentId: string;
  readonly reason?: string | undefined;
  readonly timestamp: string;
}

export interface AgentRequestReceivedPayload {
  readonly request: AgentRequest;
  readonly timestamp: string;
}

export interface AgentRequestCompletedPayload {
  readonly request: AgentRequest;
  readonly response: AgentResponse;
  readonly durationMs: number;
  readonly timestamp: string;
}

export interface AgentRequestFailedPayload {
  readonly request: AgentRequest;
  readonly error: { code: string; message: string; details?: unknown | undefined };
  readonly durationMs: number;
  readonly timestamp: string;
}
