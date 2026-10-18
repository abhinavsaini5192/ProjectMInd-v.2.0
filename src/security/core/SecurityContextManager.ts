import type { ISecurityContextManager, CreateSecurityContextOptions } from '../interfaces/ISecurityContextManager.js';
import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';
import type { SecurityContext } from '../models/SecurityContext.js';
import { isSecurityContextValid } from '../models/SecurityContext.js';
import type { IPermissionResolver } from '../interfaces/IPermissionResolver.js';
import { formatPermission } from '../models/Permission.js';
import { AuthenticationError } from '../errors/SecurityError.js';

export class SecurityContextManager implements ISecurityContextManager {
  constructor(private readonly permissionResolver?: IPermissionResolver | undefined) {}

  public async createContext(
    principal: SecurityPrincipal,
    options: CreateSecurityContextOptions = {}
  ): Promise<SecurityContext> {
    const scope = {
      workspaceId: options.workspaceId,
      repositoryId: options.repositoryId,
      sessionId: options.sessionId,
      taskId: options.taskId,
    };

    let permissions: string[] = [];
    if (this.permissionResolver) {
      const resolved = await this.permissionResolver.resolvePermissions(principal.principalId, scope);
      permissions = resolved.map((p) => formatPermission(p.action, p.resourceType));
    }

    const now = Date.now();
    const expiresAt = options.lifetimeMs ? new Date(now + options.lifetimeMs).toISOString() : undefined;

    return {
      principal,
      workspaceId: options.workspaceId,
      repositoryId: options.repositoryId,
      sessionId: options.sessionId,
      taskId: options.taskId,
      permissions,
      capabilities: options.capabilities ?? [],
      authenticationMethod: principal.authenticationMethod,
      trustLevel: options.trustLevel ?? (principal.type === 'SYSTEM' ? 'SYSTEM' : 'STANDARD'),
      requestId: options.requestId,
      correlationId: options.correlationId,
      createdAt: new Date(now).toISOString(),
      expiresAt,
    };
  }

  public validateContext(context: SecurityContext): void {
    if (!isSecurityContextValid(context)) {
      throw new AuthenticationError(
        `Security context is invalid or expired for principal '${context.principal.principalId}'`
      );
    }
  }
}
