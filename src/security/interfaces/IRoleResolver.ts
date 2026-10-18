import type { RoleAssignment } from '../models/RoleAssignment.js';
import type { Role, RoleId } from '../models/Role.js';

export interface IRoleResolver {
  getRoleAssignments(principalId: string): Promise<readonly RoleAssignment[]>;
  assignRole(assignment: RoleAssignment): Promise<void>;
  revokeRole(assignmentId: string): Promise<void>;
  getRoleDefinition(roleId: RoleId): Role | null;
}
