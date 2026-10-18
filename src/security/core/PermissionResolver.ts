import type { IPermissionResolver } from '../interfaces/IPermissionResolver.js';
import type { Permission } from '../models/Permission.js';
import type { ResourceScope } from '../models/ResourceScope.js';
import type { IRoleResolver } from '../interfaces/IRoleResolver.js';
import { isScopeContainedWithin } from '../models/ResourceScope.js';
import { formatPermission } from '../models/Permission.js';

export class PermissionResolver implements IPermissionResolver {
  constructor(private readonly roleResolver: IRoleResolver) {}

  public async resolvePermissions(
    principalId: string,
    scope: ResourceScope
  ): Promise<readonly Permission[]> {
    const assignments = await this.roleResolver.getRoleAssignments(principalId);
    const permissions: Permission[] = [];
    const seen = new Set<string>();

    for (const assignment of assignments) {
      // Check if assignment scope covers the requested scope
      if (isScopeContainedWithin(scope, assignment.scope)) {
        const role = this.roleResolver.getRoleDefinition(assignment.roleId);
        if (role) {
          for (const perm of role.permissions) {
            const key = formatPermission(perm.action, perm.resourceType);
            if (!seen.has(key)) {
              seen.add(key);
              permissions.push(perm);
            }
          }
        }
      }
    }

    return permissions;
  }

  public async hasPermission(
    principalId: string,
    permission: Permission,
    scope: ResourceScope
  ): Promise<boolean> {
    const permissions = await this.resolvePermissions(principalId, scope);
    const targetKey = formatPermission(permission.action, permission.resourceType);
    return permissions.some((p) => formatPermission(p.action, p.resourceType) === targetKey);
  }
}
