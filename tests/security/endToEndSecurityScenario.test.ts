import { describe, it, expect, beforeEach } from 'vitest';
import { AuthenticationService } from '../../src/security/core/AuthenticationService.js';
import { AuthorizationService } from '../../src/security/core/AuthorizationService.js';
import { PrincipalResolver } from '../../src/security/core/PrincipalResolver.js';
import { IdentityResolver } from '../../src/security/core/IdentityResolver.js';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { SecurityContextManager } from '../../src/security/core/SecurityContextManager.js';
import { ToolSecurityAuthorizer } from '../../src/security/integrations/ToolSecurityAuthorizer.js';
import { AuditLogger } from '../../src/security/core/AuditLogger.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { PermissionDeniedError } from '../../src/security/errors/SecurityError.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import type { RoleAssignment } from '../../src/security/models/RoleAssignment.js';

describe('Phase 8.2 Security — End-to-End Enterprise Production Scenario', () => {
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
  let auditLogger: AuditLogger;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    identityResolver = new IdentityResolver(eventBus);
    principalResolver = new PrincipalResolver(identityResolver);
    roleResolver = new RoleResolver(eventBus);
    permissionResolver = new PermissionResolver(roleResolver);
    scopeValidator = new ScopeValidator(eventBus);

    authService = new AuthenticationService(
      principalResolver,
      identityResolver,
      undefined,
      eventBus,
      {
        authRequired: true,
        environment: 'production',
        allowUnsafeDevDefaults: false,
      }
    );
    authorizer = new AuthorizationService(permissionResolver, scopeValidator, undefined, undefined, eventBus);
    toolAuthorizer = new ToolSecurityAuthorizer(authorizer);
    contextManager = new SecurityContextManager(permissionResolver);
    auditLogger = new AuditLogger();
  });

  it('executes complete production security lifecycle: auth -> rbac -> tool auth -> audit -> isolation', async () => {
    // 1. Setup Human Operator Alice
    const userAlice: SecurityPrincipal = {
      principalId: 'user_alice',
      type: 'USER',
      identityId: 'id_alice',
      displayName: 'Alice Engineer',
      status: 'ACTIVE',
      authenticationMethod: 'SESSION',
      createdAt: new Date().toISOString(),
    };
    await principalResolver.savePrincipal(userAlice);

    const aliceAssignment: RoleAssignment = {
      assignmentId: 'assign_alice',
      principalId: 'user_alice',
      roleId: 'OWNER',
      scope: { workspaceId: 'ws_production' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'system',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(aliceAssignment);

    // 2. Setup External Coding Agent Cursor
    const agentCursor: SecurityPrincipal = {
      principalId: 'agent_cursor_v1',
      type: 'AGENT',
      identityId: 'id_cursor',
      displayName: 'Cursor IDE Agent',
      status: 'ACTIVE',
      authenticationMethod: 'API_KEY',
      createdAt: new Date().toISOString(),
    };
    await principalResolver.savePrincipal(agentCursor);

    const cursorAssignment: RoleAssignment = {
      assignmentId: 'assign_cursor',
      principalId: 'agent_cursor_v1',
      roleId: 'AGENT',
      scope: { workspaceId: 'ws_production', repositoryId: 'repo_backend' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'user_alice',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(cursorAssignment);

    // 3. Authenticate Agent via API_KEY
    const authResult = await authService.authenticate({
      method: 'API_KEY',
      apiKey: 'agent_cursor_v1',
    });
    expect(authResult.success).toBe(true);
    expect(authResult.principal?.principalId).toBe('agent_cursor_v1');

    await auditLogger.logEvent({
      principalId: 'agent_cursor_v1',
      eventType: 'AUTHENTICATION_SUCCESS',
      workspaceId: 'ws_production',
      result: 'SUCCESS',
      details: { method: 'API_KEY' },
    });

    // 4. Create SecurityContext for Agent Session
    const secContext = await contextManager.createContext(authResult.principal!, {
      workspaceId: 'ws_production',
      repositoryId: 'repo_backend',
      sessionId: 'session_cursor_101',
      capabilities: ['READ_CONTEXT', 'REPORT_EXECUTION'],
      trustLevel: 'STANDARD',
    });
    expect(secContext.workspaceId).toBe('ws_production');
    expect(secContext.repositoryId).toBe('repo_backend');

    // 5. Agent calls projectmind_get_context -> Authorized
    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_get_context', secContext)
    ).resolves.not.toThrow();

    await auditLogger.logEvent({
      principalId: 'agent_cursor_v1',
      eventType: 'SENSITIVE_TOOL_EXECUTION',
      workspaceId: 'ws_production',
      repositoryId: 'repo_backend',
      resourceType: 'CONTEXT',
      resourceId: 'projectmind_get_context',
      action: 'READ',
      result: 'SUCCESS',
      details: {
        toolName: 'projectmind_get_context',
        sessionId: 'session_cursor_101',
      },
    });

    // 6. Agent calls projectmind_report_execution -> Authorized
    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_report_execution', secContext)
    ).resolves.not.toThrow();

    await auditLogger.logEvent({
      principalId: 'agent_cursor_v1',
      eventType: 'SECURITY_VIOLATION',
      workspaceId: 'ws_production',
      repositoryId: 'repo_backend',
      resourceType: 'OBSERVATION',
      resourceId: 'projectmind_report_execution',
      action: 'REPORT',
      result: 'SUCCESS',
      details: {
        findingsCount: 3,
        provenance: 'AGENT_REPORTED',
      },
    });

    // 7. Security Violation Attempt 1: Agent tries cross-workspace access to ws_finance -> Denied
    await expect(
      toolAuthorizer.authorizeToolCall('projectmind_get_context', secContext, {
        workspaceId: 'ws_finance',
        repositoryId: 'repo_payroll',
      })
    ).rejects.toThrow(PermissionDeniedError);

    await auditLogger.logEvent({
      principalId: 'agent_cursor_v1',
      eventType: 'AUTHORIZATION_DENIAL',
      workspaceId: 'ws_finance',
      resourceType: 'CONTEXT',
      action: 'READ',
      result: 'FAILURE',
      details: {
        reason: 'Cross-workspace access attempt blocked',
        attemptedWorkspace: 'ws_finance',
      },
    });

    // 8. Security Violation Attempt 2: Agent tries arbitrary execution -> Denied
    const execAttempt = await authorizer.authorize({
      principal: agentCursor,
      action: 'EXECUTE',
      resourceType: 'REPOSITORY',
      scope: { workspaceId: 'ws_production', repositoryId: 'repo_backend' },
      context: secContext,
    });
    expect(execAttempt.allowed).toBe(false);
    expect(execAttempt.reason).toContain('External agents cannot execute arbitrary processes');

    // 9. Verify Audit Trail Completeness
    const cursorAuditTrail = await auditLogger.queryEvents({ principalId: 'agent_cursor_v1' });
    expect(cursorAuditTrail.length).toBe(4);
    expect(cursorAuditTrail[0]?.eventType).toBe('AUTHENTICATION_SUCCESS');
    expect(cursorAuditTrail[1]?.eventType).toBe('SENSITIVE_TOOL_EXECUTION');
    expect(cursorAuditTrail[2]?.eventType).toBe('SECURITY_VIOLATION');
    expect(cursorAuditTrail[3]?.eventType).toBe('AUTHORIZATION_DENIAL');
  });
});
