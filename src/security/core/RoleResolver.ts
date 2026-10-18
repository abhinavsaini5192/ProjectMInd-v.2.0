import type { IRoleResolver } from '../interfaces/IRoleResolver.js';
import type { RoleAssignment } from '../models/RoleAssignment.js';
import type { Role, RoleId } from '../models/Role.js';
import { STANDARD_ROLES } from '../models/Role.js';
import { isRoleAssignmentActive } from '../models/RoleAssignment.js';
import type { IEventBus } from '../../events/index.js';
import { SECURITY_EVENTS } from '../events/SecurityEvents.js';

export class RoleResolver implements IRoleResolver {
  private readonly assignments = new Map<string, RoleAssignment[]>();
  private readonly assignmentById = new Map<string, RoleAssignment>();

  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public async getRoleAssignments(principalId: string): Promise<readonly RoleAssignment[]> {
    const list = this.assignments.get(principalId) ?? [];
    const now = new Date();
    return list.filter((a) => isRoleAssignmentActive(a, now));
  }

  public async assignRole(assignment: RoleAssignment): Promise<void> {
    const list = this.assignments.get(assignment.principalId) ?? [];
    list.push(assignment);
    this.assignments.set(assignment.principalId, list);
    this.assignmentById.set(assignment.assignmentId, assignment);

    if (this.eventBus) {
      this.eventBus.publish(SECURITY_EVENTS.PERMISSION_CHANGED, {
        principalId: assignment.principalId,
        grantedPermissions: [assignment.roleId],
        revokedPermissions: [],
        updatedBy: assignment.assignedBy,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async revokeRole(assignmentId: string): Promise<void> {
    const assignment = this.assignmentById.get(assignmentId);
    if (!assignment) {
      return;
    }

    const updated: RoleAssignment = {
      ...assignment,
      status: 'REVOKED',
    };
    this.assignmentById.set(assignmentId, updated);

    const list = this.assignments.get(assignment.principalId) ?? [];
    const updatedList = list.map((a) => (a.assignmentId === assignmentId ? updated : a));
    this.assignments.set(assignment.principalId, updatedList);

    if (this.eventBus) {
      this.eventBus.publish(SECURITY_EVENTS.PERMISSION_CHANGED, {
        principalId: assignment.principalId,
        grantedPermissions: [],
        revokedPermissions: [assignment.roleId],
        updatedBy: 'SYSTEM',
        timestamp: new Date().toISOString(),
      });
    }
  }

  public getRoleDefinition(roleId: RoleId): Role | null {
    return STANDARD_ROLES[roleId] ?? null;
  }
}
