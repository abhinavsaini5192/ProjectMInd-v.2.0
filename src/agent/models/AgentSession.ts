import type { AgentCapabilitySet } from './AgentCapabilitySet.js';

export type AgentSessionStatus = 'ACTIVE' | 'IDLE' | 'TERMINATED' | 'EXPIRED';

/**
 * An active, contextual working session bound to an agent and workspace.
 */
export interface AgentSession {
  readonly sessionId: string;
  readonly agentId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly branch?: string | undefined;
  readonly commit?: string | undefined;
  readonly workingTreeState?: ('CLEAN' | 'DIRTY' | 'UNKNOWN') | undefined;
  readonly taskId?: string | undefined;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly status: AgentSessionStatus;
  readonly capabilities: AgentCapabilitySet;
  readonly protocolVersion: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Parameters for initializing a new session.
 */
export interface AgentSessionCreateParams {
  readonly agentId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly branch?: string | undefined;
  readonly commit?: string | undefined;
  readonly workingTreeState?: ('CLEAN' | 'DIRTY' | 'UNKNOWN') | undefined;
  readonly taskId?: string | undefined;
  readonly requestedCapabilities?: AgentCapabilitySet | string[] | undefined;
  readonly protocolVersion?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
