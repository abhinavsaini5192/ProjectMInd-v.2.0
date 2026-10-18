import { describe, it, expect, beforeEach } from 'vitest';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { ROLE_HIERARCHY_RANKS, STANDARD_ROLES } from '../../src/security/models/Role.js';
import type { RoleAssignment } from '../../src/security/models/RoleAssignment.js';

describe('Phase 8.2 Security — Roles and Permissions', () => {
  let roleResolver: RoleResolver;
  let permissionResolver: PermissionResolver;
  let eventBus: NodeEventBus;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    roleResolver = new RoleResolver(eventBus);
    permissionResolver = new PermissionResolver(roleResolver);
  });

  it('verifies canonical role hierarchy ordering', () => {
    expect(ROLE_HIERARCHY_RANKS.OWNER).toBeGreaterThan(ROLE_HIERARCHY_RANKS.ADMIN);
    expect(ROLE_HIERARCHY_RANKS.ADMIN).toBeGreaterThan(ROLE_HIERARCHY_RANKS.MEMBER);
    expect(ROLE_HIERARCHY_RANKS.MEMBER).toBeGreaterThan(ROLE_HIERARCHY_RANKS.CONTRIBUTOR);
    expect(ROLE_HIERARCHY_RANKS.CONTRIBUTOR).toBeGreaterThan(ROLE_HIERARCHY_RANKS.VIEWER);
    expect(ROLE_HIERARCHY_RANKS.VIEWER).toBeGreaterThan(ROLE_HIERARCHY_RANKS.AGENT);
  });

  it('assigns role and resolves inherited permissions', async () => {
    const assignment: RoleAssignment = {
      assignmentId: 'assign_101',
      principalId: 'user_bob',
      roleId: 'MEMBER',
      scope: { workspaceId: 'ws_beta' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'system',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(assignment);

    const hasRead = await permissionResolver.hasPermission(
      'user_bob',
      { action: 'READ', resourceType: 'CONTEXT' },
      { workspaceId: 'ws_beta' }
    );
    expect(hasRead).toBe(true);

    const hasAdmin = await permissionResolver.hasPermission(
      'user_bob',
      { action: 'ADMINISTER', resourceType: 'WORKSPACE' },
      { workspaceId: 'ws_beta' }
    );
    expect(hasAdmin).toBe(false);
  });

  it('revokes role assignment and updates effective permissions', async () => {
    const assignment: RoleAssignment = {
      assignmentId: 'assign_temp',
      principalId: 'user_temp',
      roleId: 'CONTRIBUTOR',
      scope: { workspaceId: 'ws_gamma' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'admin',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(assignment);

    let perms = await permissionResolver.resolvePermissions('user_temp', { workspaceId: 'ws_gamma' });
    expect(perms.length).toBeGreaterThan(0);

    await roleResolver.revokeRole('assign_temp');

    perms = await permissionResolver.resolvePermissions('user_temp', { workspaceId: 'ws_gamma' });
    expect(perms.length).toBe(0);
  });

  it('ignores expired role assignments', async () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    const assignment: RoleAssignment = {
      assignmentId: 'assign_expired',
      principalId: 'user_exp',
      roleId: 'VIEWER',
      scope: { workspaceId: 'ws_delta' },
      assignedAt: new Date(Date.now() - 7200000).toISOString(),
      assignedBy: 'admin',
      expiresAt: past,
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(assignment);

    const assignments = await roleResolver.getRoleAssignments('user_exp');
    expect(assignments.length).toBe(0);

    const hasPerm = await permissionResolver.hasPermission(
      'user_exp',
      { action: 'READ', resourceType: 'CONTEXT' },
      { workspaceId: 'ws_delta' }
    );
    expect(hasPerm).toBe(false);
  });

  it('provides comprehensive standard role definitions', () => {
    const agentRole = STANDARD_ROLES.AGENT;
    expect(agentRole.permissions.some((p) => p.action === 'READ' && p.resourceType === 'CONTEXT')).toBe(true);
    expect(agentRole.permissions.some((p) => p.action === 'REPORT' && p.resourceType === 'OBSERVATION')).toBe(true);
    expect(agentRole.permissions.some((p) => p.action === 'ADMINISTER')).toBe(false);
  });
});
