import type { RoleId } from './Role.js';
import type { ResourceScope } from './ResourceScope.js';

export interface RoleAssignment {
  readonly assignmentId: string;
  readonly principalId: string;
  readonly roleId: RoleId;
  readonly scope: ResourceScope;
  readonly assignedAt: string;
  readonly assignedBy: string;
  readonly expiresAt?: string | undefined;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export function isRoleAssignmentActive(assignment: RoleAssignment, now: Date = new Date()): boolean {
  if (assignment.status !== 'ACTIVE') {
    return false;
  }
  if (assignment.expiresAt) {
    const expiration = new Date(assignment.expiresAt).getTime();
    if (now.getTime() > expiration) {
      return false;
    }
  }
  return true;
}
