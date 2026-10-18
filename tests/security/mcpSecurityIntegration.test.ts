import { describe, it, expect, beforeEach } from 'vitest';
import { AuthenticationService } from '../../src/security/core/AuthenticationService.js';
import { AuthorizationService } from '../../src/security/core/AuthorizationService.js';
import { PrincipalResolver } from '../../src/security/core/PrincipalResolver.js';
import { IdentityResolver } from '../../src/security/core/IdentityResolver.js';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { ToolSecurityAuthorizer } from '../../src/security/integrations/ToolSecurityAuthorizer.js';
import { SecurityContextManager } from '../../src/security/core/SecurityContextManager.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import type { RoleAssignment } from '../../src/security/models/RoleAssignment.js';
import { LogRedactor } from '../../src/platform/logging/LogRedactor.js';

describe('Phase 8.2 Security — MCP Protocol Security Integration', () => {
  let eventBus: NodeEventBus;
  let identityResolver: IdentityResolver;
  let principalResolver: PrincipalResolver;
  let roleResolver: RoleResolver;
  let permissionResolver: PermissionResolver;
  let scopeValidator: ScopeValidator;
  let authService: AuthenticationService;
  let authorizer: AuthorizationService;
  let toolAuthorizer: ToolSecurityAuthorizer;
  let contextManager: SecurityContextManager;

  const mcpPrincipal: SecurityPrincipal = {
    principalId: 'mcp_client_cline',
    type: 'AGENT',
    identityId: 'id_cline',
    status: 'ACTIVE',
    authenticationMethod: 'API_KEY',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    eventBus = new NodeEventBus();
    identityResolver = new IdentityResolver(eventBus);
    principalResolver = new PrincipalResolver(identityResolver);
    roleResolver = new RoleResolver(eventBus);
    permissionResolver = new PermissionResolver(roleResolver);
    scopeValidator = new ScopeValidator(eventBus);

    authService = new AuthenticationService(principalResolver, identityResolver, undefined, eventBus);
    authorizer = new AuthorizationService(permissionResolver, scopeValidator, undefined, undefined, eventBus);
    toolAuthorizer = new ToolSecurityAuthorizer(authorizer);
    contextManager = new SecurityContextManager(permissionResolver);

    await principalResolver.savePrincipal(mcpPrincipal);

    const assignment: RoleAssignment = {
      assignmentId: 'assign_mcp',
      principalId: 'mcp_client_cline',
      roleId: 'AGENT',
      scope: { workspaceId: 'ws_mcp_sandbox', repositoryId: 'repo_app' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'system',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(assignment);
  });

  it('authenticates and creates verified security context for MCP client', async () => {
    const authResult = await authService.authenticate({
      method: 'API_KEY',
      apiKey: 'mcp_client_cline',
    });
    expect(authResult.success).toBe(true);
    expect(authResult.principal?.principalId).toBe('mcp_client_cline');

    const secContext = await contextManager.createContext(authResult.principal!, {
      workspaceId: 'ws_mcp_sandbox',
      repositoryId: 'repo_app',
      capabilities: ['READ_CONTEXT', 'REPORT_EXECUTION'],
    });

    expect(secContext.workspaceId).toBe('ws_mcp_sandbox');
    expect(secContext.permissions.includes('READ:CONTEXT')).toBe(true);
  });

  it('rejects MCP tool request attempting to forge target workspace', async () => {
    const secContext = await contextManager.createContext(mcpPrincipal, {
      workspaceId: 'ws_mcp_sandbox',
      repositoryId: 'repo_app',
      capabilities: ['READ_CONTEXT'],
    });

    // Client attempts to query foreign workspace ws_production_core
    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_get_context', secContext, {
        workspaceId: 'ws_production_core',
        repositoryId: 'repo_secret_backend',
      })
    ).rejects.toThrow();
  });

  it('redacts sensitive credentials in MCP tool output and error payloads', () => {
    const rawMcpResponse = {
      content: [
        {
          type: 'text',
          text: 'Configuration successfully generated with databaseUrl=postgres://admin:super_secret_pw@db.prod.internal:5432/main',
        },
      ],
      metadata: {
        apiKey: 'sk_live_12345abcdef67890',
        token: 'bearer_token_xyz',
      },
    };

    const redacted = LogRedactor.redactObject(rawMcpResponse) as typeof rawMcpResponse;
    expect(redacted.metadata.apiKey).toBe('[REDACTED]');
    expect(redacted.metadata.token).toBe('[REDACTED]');
    expect(redacted.content[0]?.text).toContain('admin:[REDACTED]@db.prod.internal');
  });
});
