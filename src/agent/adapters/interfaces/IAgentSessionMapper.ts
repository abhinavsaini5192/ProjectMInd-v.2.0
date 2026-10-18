import type { AdapterSession } from '../models/AdapterSession.js';
import type { AgentProvider } from '../models/AgentProvider.js';
import type { AgentProtocol } from '../models/AgentProtocol.js';

export interface SessionLinkOptions {
  readonly adapterId?: string | undefined;
  readonly provider?: AgentProvider | undefined;
  readonly protocol?: AgentProtocol | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface IAgentSessionMapper {
  mapSession(
    providerSessionId: string,
    canonicalSessionId?: string,
    options?: SessionLinkOptions
  ): AdapterSession;
  getCanonicalSessionId(providerSessionId: string): string | undefined;
  getProviderSessionId(canonicalSessionId: string): string | undefined;
  linkSession(
    providerSessionId: string,
    canonicalSessionId: string,
    options?: SessionLinkOptions
  ): AdapterSession;
  unlinkSession(providerSessionId: string): boolean;
  clear(): void;
}
