import type { SecurityPrincipal, AuthenticationMethod } from './SecurityPrincipal.js';
import type { SecurityTrustLevel } from './AgentIdentity.js';
import type { ResourceScope } from './ResourceScope.js';

export interface SecurityContext {
  readonly principal: SecurityPrincipal;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly sessionContext?: { correlationId?: string | undefined } | undefined;
  readonly isGlobalAdmin?: (() => boolean) | undefined;
  readonly taskId?: string | undefined;
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
  readonly authenticationMethod: AuthenticationMethod;
  readonly trustLevel: SecurityTrustLevel;
  readonly requestId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly createdAt: string;
  readonly expiresAt?: string | undefined;
  readonly scope?: ResourceScope | Record<string, unknown> | undefined;
  readonly securityLevel?: string | undefined;
  readonly authenticatedAt?: string | undefined;
}

export function isSecurityContextValid(context: SecurityContext, now: Date = new Date()): boolean {
  if (context.principal.status !== 'ACTIVE') {
    return false;
  }
  if (context.expiresAt) {
    const expiration = new Date(context.expiresAt).getTime();
    if (now.getTime() > expiration) {
      return false;
    }
  }
  return true;
}

export function getSecurityContextScope(context: SecurityContext): ResourceScope {
  return {
    workspaceId: context.workspaceId,
    repositoryId: context.repositoryId,
    sessionId: context.sessionId,
    taskId: context.taskId,
  };
}
