import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';
import type { SecurityContext } from '../models/SecurityContext.js';
import type { SecurityTrustLevel } from '../models/AgentIdentity.js';

export interface CreateSecurityContextOptions {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly capabilities?: readonly string[] | undefined;
  readonly trustLevel?: SecurityTrustLevel | undefined;
  readonly requestId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly lifetimeMs?: number | undefined;
}

export interface ISecurityContextManager {
  createContext(principal: SecurityPrincipal, options?: CreateSecurityContextOptions): Promise<SecurityContext>;
  validateContext(context: SecurityContext): void;
}
