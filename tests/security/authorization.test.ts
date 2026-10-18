import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationService } from '../../src/security/core/AuthorizationService.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { SECURITY_EVENTS } from '../../src/security/events/SecurityEvents.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import type { RoleAssignment } from '../../src/security/models/RoleAssignment.js';

describe('Phase 8.2 Security — AuthorizationService', () => {
  let roleResolver: RoleResolver;
  let permissionResolver: PermissionResolver;
  let scopeValidator: ScopeValidator;
  let eventBus: NodeEventBus;
  let authorizer: AuthorizationService;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    roleResolver = new RoleResolver(eventBus);
    permissionResolver = new PermissionResolver(roleResolver);
    scopeValidator = new ScopeValidator(eventBus);
    authorizer = new AuthorizationService(
      permissionResolver,
      scopeValidator,
      undefined,
      undefined,
      eventBus
    );
  });

  const activeUser: SecurityPrincipal = {
    principalId: 'user_alice',
    type: 'USER',
    identityId: 'id_alice',
    status: 'ACTIVE',
    authenticationMethod: 'SESSION',
    createdAt: new Date().toISOString(),
  };

  const activeAgent: SecurityPrincipal = {
    principalId: 'agent_cursor',
    type: 'AGENT',
    identityId: 'id_cursor',
    status: 'ACTIVE',
    authenticationMethod: 'API_KEY',
    createdAt: new Date().toISOString(),
  };

  it('enforces default deny: missing permission is denied and emits event', async () => {
    let denialEmitted = false;
    eventBus.subscribe(SECURITY_EVENTS.AUTHORIZATION_DENIED, (event: any) => {
      expect(event.payload.principalId).toBe('user_alice');
      expect(event.payload.action).toBe('DELETE');
      expect(event.payload.resourceType).toBe('REPOSITORY');
      denialEmitted = true;
    });

    const result = await authorizer.authorize({
      principal: activeUser,
      action: 'DELETE',
      resourceType: 'REPOSITORY',
      scope: { workspaceId: 'ws_alpha' },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Missing required permission');
    expect(result.requiredPermission).toBe('DELETE:REPOSITORY');
    expect(denialEmitted).toBe(true);
  });

  it('allows action when principal has assigned role with permission', async () => {
    const assignment: RoleAssignment = {
      assignmentId: 'assign_1',
      principalId: 'user_alice',
      roleId: 'MEMBER',
      scope: { workspaceId: 'ws_alpha' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'admin',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(assignment);

    const result = await authorizer.authorize({
      principal: activeUser,
      action: 'READ',
      resourceType: 'CONTEXT',
      scope: { workspaceId: 'ws_alpha' },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('Access granted');
  });

  it('denies access if principal is disabled', async () => {
    const disabledUser: SecurityPrincipal = {
      ...activeUser,
      status: 'DISABLED',
    };

    const result = await authorizer.authorize({
      principal: disabledUser,
      action: 'READ',
      resourceType: 'CONTEXT',
      scope: { workspaceId: 'ws_alpha' },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('disabled');
  });

  it('strictly prohibits arbitrary EXECUTE on non-tool resources', async () => {
    const ownerAssignment: RoleAssignment = {
      assignmentId: 'assign_owner',
      principalId: 'user_alice',
      roleId: 'OWNER',
      scope: { global: true },
      assignedAt: new Date().toISOString(),
      assignedBy: 'admin',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(ownerAssignment);

    const result = await authorizer.authorize({
      principal: activeUser,
      action: 'EXECUTE',
      resourceType: 'REPOSITORY',
      scope: { workspaceId: 'ws_alpha' },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Arbitrary execution of non-tool resources is prohibited');
  });

  it('rejects external agent claiming SYSTEM identity prefix', async () => {
    const rogueAgent: SecurityPrincipal = {
      ...activeAgent,
      identityId: 'system_imposter',
    };

    const result = await authorizer.authorize({
      principal: rogueAgent,
      action: 'READ',
      resourceType: 'CONTEXT',
      scope: { workspaceId: 'ws_alpha' },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('cannot assume SYSTEM identity');
  });
});
