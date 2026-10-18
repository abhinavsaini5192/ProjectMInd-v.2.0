import type { AgentProvider } from './AgentProvider.js';
import type { AgentProtocol } from './AgentProtocol.js';

export interface AdapterSession {
  readonly canonicalSessionId: string;
  readonly providerSessionId: string;
  readonly adapterId: string;
  readonly provider: AgentProvider;
  readonly protocol: AgentProtocol;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly taskId?: string | undefined;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly metadata: Record<string, unknown>;
}
