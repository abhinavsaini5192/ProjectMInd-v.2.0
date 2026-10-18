import type { Permission } from '../models/Permission.js';
import type { ResourceScope } from '../models/ResourceScope.js';

export interface IPermissionResolver {
  resolvePermissions(principalId: string, scope: ResourceScope): Promise<readonly Permission[]>;
  hasPermission(principalId: string, permission: Permission, scope: ResourceScope): Promise<boolean>;
}
