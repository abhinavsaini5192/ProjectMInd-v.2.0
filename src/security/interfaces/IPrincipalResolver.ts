import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';

export interface IPrincipalResolver {
  resolvePrincipal(identityId: string): Promise<SecurityPrincipal | null>;
  getPrincipal(principalId: string): Promise<SecurityPrincipal | null>;
  savePrincipal(principal: SecurityPrincipal): Promise<void>;
}
