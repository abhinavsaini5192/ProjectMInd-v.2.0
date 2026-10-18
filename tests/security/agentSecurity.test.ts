import { describe, it, expect, beforeEach } from 'vitest';
import { AgentPolicy } from '../../src/security/policies/AgentPolicy.js';
import { AuthorizationService } from '../../src/security/core/AuthorizationService.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import type { RoleAssignment } from '../../src/security/models/RoleAssignment.js';
import type { AgentIdentity } from '../../src/security/models/AgentIdentity.js';
import { isAgentIdentity } from '../../src/security/models/AgentIdentity.js';

describe('Phase 8.2 Security — External Agent Security Baseline', () => {
  let roleResolver: RoleResolver;
  let permissionResolver: PermissionResolver;
  let scopeValidator: ScopeValidator;
  let authorizer: AuthorizationService;
  let eventBus: NodeEventBus;

  beforeEach(async () => {
    eventBus = new NodeEventBus();
    roleResolver = new RoleResolver(eventBus);
    permissionResolver = new PermissionResolver(roleResolver);
    scopeValidator = new ScopeValidator(eventBus);
    authorizer = new AuthorizationService(permissionResolver, scopeValidator, undefined, undefined, eventBus);

    // Assign standard AGENT role to agent_cline
    const agentRoleAssignment: RoleAssignment = {
      assignmentId: 'assign_cline',
      principalId: 'agent_cline',
      roleId: 'AGENT',
      scope: { workspaceId: 'ws_prod' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'system',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(agentRoleAssignment);
  });

  const agentPrincipal: SecurityPrincipal = {
    principalId: 'agent_cline',
    type: 'AGENT',
    identityId: 'id_cline_v2',
    status: 'ACTIVE',
    authenticationMethod: 'API_KEY',
    createdAt: new Date().toISOString(),
  };

  it('validates AgentIdentity model persistence and characteristics', () => {
    const agentId: AgentIdentity = {
      identityId: 'id_cline_v2',
      type: 'AGENT',
      agentId: 'cline_agent_instance',
      adapterId: 'cline_mcp_adapter',
      provider: 'cline',
      protocol: 'mcp',
      status: 'ACTIVE',
      capabilities: ['READ_CONTEXT', 'REPORT_EXECUTION'],
      trustLevel: 'STANDARD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isAgentIdentity(agentId)).toBe(true);
    expect(agentId.type).toBe('AGENT');
    expect(agentId.trustLevel).toBe('STANDARD');
  });

  it('allows agent to read context, features, and report observations', async () => {
    // 1. Read context
    const readContextRes = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'READ',
      resourceType: 'CONTEXT',
      scope: { workspaceId: 'ws_prod' },
    });
    expect(readContextRes.allowed).toBe(true);

    // 2. Read feature
    const readFeatureRes = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'READ',
      resourceType: 'FEATURE',
      scope: { workspaceId: 'ws_prod' },
    });
    expect(readFeatureRes.allowed).toBe(true);

    // 3. Report observation
    const reportObsRes = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'REPORT',
      resourceType: 'OBSERVATION',
      scope: { workspaceId: 'ws_prod' },
    });
    expect(reportObsRes.allowed).toBe(true);
  });

  it('strictly denies agent from arbitrary code or shell execution', async () => {
    const execRes = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'EXECUTE',
      resourceType: 'REPOSITORY',
      scope: { workspaceId: 'ws_prod' },
    });

    expect(execRes.allowed).toBe(false);
    expect(execRes.reason).toContain('External agents cannot execute arbitrary processes or repository code');
  });

  it('strictly denies agent from modifying security policies or roles', async () => {
    const policyRes = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'UPDATE',
      resourceType: 'SECURITY_POLICY',
      scope: { workspaceId: 'ws_prod' },
    });

    expect(policyRes.allowed).toBe(false);
    expect(policyRes.reason).toContain('External agents cannot modify security policies');
  });

  it('strictly denies agent from modifying platform configuration', async () => {
    const configRes = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'CONFIGURE',
      resourceType: 'CONFIGURATION',
      scope: { workspaceId: 'ws_prod' },
    });

    expect(configRes.allowed).toBe(false);
    expect(configRes.reason).toContain('External agents cannot modify platform or system configuration');
  });

  it('enforces knowledge mutation restrictions based on trust level', () => {
    // UNTRUSTED agent is denied
    const untrustedRes = AgentPolicy.evaluateAgentAction({
      action: 'UPDATE',
      resourceType: 'KNOWLEDGE',
      trustLevel: 'UNTRUSTED',
    });
    expect(untrustedRes.allowed).toBe(false);
    expect(untrustedRes.reason).toContain('UNTRUSTED agents cannot mutate the knowledge graph');

    // STANDARD agent without explicit grant is denied
    const standardRes = AgentPolicy.evaluateAgentAction({
      action: 'UPDATE',
      resourceType: 'KNOWLEDGE',
      trustLevel: 'STANDARD',
      hasExplicitGrant: false,
    });
    expect(standardRes.allowed).toBe(false);
    expect(standardRes.reason).toContain('Knowledge mutation requires explicit authorization grant');

    // VERIFIED agent is permitted
    const verifiedRes = AgentPolicy.evaluateAgentAction({
      action: 'UPDATE',
      resourceType: 'KNOWLEDGE',
      trustLevel: 'VERIFIED',
    });
    expect(verifiedRes.allowed).toBe(true);
  });
});
