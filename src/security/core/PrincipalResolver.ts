import type { IPrincipalResolver } from '../interfaces/IPrincipalResolver.js';
import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';
import type { IIdentityResolver } from '../interfaces/IIdentityResolver.js';

export class PrincipalResolver implements IPrincipalResolver {
  private readonly principals = new Map<string, SecurityPrincipal>();
  private readonly identityToPrincipal = new Map<string, string>();

  constructor(private readonly identityResolver?: IIdentityResolver | undefined) {}

  public async getPrincipal(principalId: string): Promise<SecurityPrincipal | null> {
    return this.principals.get(principalId) ?? null;
  }

  public async resolvePrincipal(identityId: string): Promise<SecurityPrincipal | null> {
    const principalId = this.identityToPrincipal.get(identityId);
    if (principalId) {
      const existing = this.principals.get(principalId);
      if (existing) {
        return existing;
      }
    }

    if (this.identityResolver) {
      const identity = await this.identityResolver.getIdentity(identityId);
      if (identity) {
        const principal: SecurityPrincipal = {
          principalId: `principal_${identity.identityId}`,
          type: identity.type,
          identityId: identity.identityId,
          status: identity.status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED',
          authenticationMethod: 'SESSION',
          createdAt: identity.createdAt,
          metadata: identity.metadata,
        };
        await this.savePrincipal(principal);
        return principal;
      }
    }

    return null;
  }

  public async savePrincipal(principal: SecurityPrincipal): Promise<void> {
    this.principals.set(principal.principalId, principal);
    this.identityToPrincipal.set(principal.identityId, principal.principalId);
  }
}
