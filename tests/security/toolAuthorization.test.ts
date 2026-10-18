import { describe, it, expect, beforeEach } from 'vitest';
import { ToolSecurityAuthorizer } from '../../src/security/integrations/ToolSecurityAuthorizer.js';
import { AuthorizationService } from '../../src/security/core/AuthorizationService.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { PermissionDeniedError } from '../../src/security/errors/SecurityError.js';
import type { SecurityContext } from '../../src/security/models/SecurityContext.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import type { RoleAssignment } from '../../src/security/models/RoleAssignment.js';

describe('Phase 8.2 Security — Tool Protocol Security Authorization', () => {
  let roleResolver: RoleResolver;
  let permissionResolver: PermissionResolver;
  let scopeValidator: ScopeValidator;
  let authorizer: AuthorizationService;
  let toolAuthorizer: ToolSecurityAuthorizer;
  let eventBus: NodeEventBus;

  const agentPrincipal: SecurityPrincipal = {
    principalId: 'agent_windsurf',
    type: 'AGENT',
    identityId: 'id_windsurf',
    status: 'ACTIVE',
    authenticationMethod: 'API_KEY',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    eventBus = new NodeEventBus();
    roleResolver = new RoleResolver(eventBus);
    permissionResolver = new PermissionResolver(roleResolver);
    scopeValidator = new ScopeValidator(eventBus);
    authorizer = new AuthorizationService(permissionResolver, scopeValidator, undefined, undefined, eventBus);
    toolAuthorizer = new ToolSecurityAuthorizer(authorizer);

    // Assign AGENT role in ws_main
    const assignment: RoleAssignment = {
      assignmentId: 'assign_windsurf',
      principalId: 'agent_windsurf',
      roleId: 'AGENT',
      scope: { workspaceId: 'ws_main' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'admin',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(assignment);
  });

  it('authorizes canonical read and report tool calls', async () => {
    const context: SecurityContext = {
      principal: agentPrincipal,
      workspaceId: 'ws_main',
      repositoryId: 'repo_core',
      permissions: ['READ:CONTEXT', 'REPORT:OBSERVATION'],
      capabilities: ['READ_CONTEXT', 'REPORT_EXECUTION'],
      authenticationMethod: 'API_KEY',
      trustLevel: 'STANDARD',
      createdAt: new Date().toISOString(),
    };

    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_get_context', context)
    ).resolves.not.toThrow();

    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_report_execution', context)
    ).resolves.not.toThrow();
  });

  it('denies tool call if agent lacks the required technical capability', async () => {
    const context: SecurityContext = {
      principal: agentPrincipal,
      workspaceId: 'ws_main',
      repositoryId: 'repo_core',
      permissions: ['READ:CONTEXT'],
      capabilities: [], // Missing 'READ_CONTEXT' capability
      authenticationMethod: 'API_KEY',
      trustLevel: 'STANDARD',
      createdAt: new Date().toISOString(),
    };

    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_get_context', context)
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('denies tool call if agent has capability but lacks required permission', async () => {
    const context: SecurityContext = {
      principal: agentPrincipal,
      workspaceId: 'ws_main',
      repositoryId: 'repo_core',
      permissions: ['READ:CONTEXT'],
      capabilities: ['UPDATE_KNOWLEDGE'], // Has capability, but AGENT role lacks UPDATE:KNOWLEDGE
      authenticationMethod: 'API_KEY',
      trustLevel: 'STANDARD',
      createdAt: new Date().toISOString(),
    };

    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_update_knowledge', context)
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('rejects cross-scope tool call execution', async () => {
    const context: SecurityContext = {
      principal: agentPrincipal,
      workspaceId: 'ws_main',
      repositoryId: 'repo_core',
      permissions: ['READ:CONTEXT'],
      capabilities: ['READ_CONTEXT'],
      authenticationMethod: 'API_KEY',
      trustLevel: 'STANDARD',
      createdAt: new Date().toISOString(),
    };

    // Target scope points to foreign workspace ws_other
    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_get_context', context, {
        workspaceId: 'ws_other',
        repositoryId: 'repo_other',
      })
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('redacts sensitive parameters before tool processing', () => {
    const sensitiveParams = {
      repositoryId: 'repo_core',
      apiKey: 'pm_secret_1234567890abcdef',
      token: 'bearer_token_abc_xyz',
      nested: {
        password: 'my_super_secret_password',
        safeField: 'projectmind',
      },
    };

    const sanitized = toolAuthorizer.sanitizeToolParameters(sensitiveParams);
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.nested.password).toBe('[REDACTED]');
    expect(sanitized.nested.safeField).toBe('projectmind');
  });
});
