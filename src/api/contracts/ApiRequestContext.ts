import type { SecurityPrincipal, SecurityContext } from '../../security/models/index.js';

export interface ApiRequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly apiVersion: string;
  readonly receivedAt: number;
  readonly principal: SecurityPrincipal;
  readonly securityPrincipal?: SecurityPrincipal | undefined;
  readonly userId?: string | undefined;
  readonly securityContext: SecurityContext;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly clientIp?: string | undefined;
  readonly userAgent?: string | undefined;
}
