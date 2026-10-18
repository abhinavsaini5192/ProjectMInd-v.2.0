import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationService } from '../../src/security/core/AuthorizationService.js';
import { PermissionResolver } from '../../src/security/core/PermissionResolver.js';
import { RoleResolver } from '../../src/security/core/RoleResolver.js';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { SecurityContextManager } from '../../src/security/core/SecurityContextManager.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import type { RoleAssignment } from '../../src/security/models/RoleAssignment.js';

describe('Phase 8.2 Security — Verification & Observation Security', () => {
  let roleResolver: RoleResolver;
  let permissionResolver: PermissionResolver;
  let scopeValidator: ScopeValidator;
  let authorizer: AuthorizationService;
  let contextManager: SecurityContextManager;
  let eventBus: NodeEventBus;

  const agentPrincipal: SecurityPrincipal = {
    principalId: 'agent_gemini',
    type: 'AGENT',
    identityId: 'id_gemini_cli',
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
    contextManager = new SecurityContextManager(permissionResolver);

    const assignment: RoleAssignment = {
      assignmentId: 'assign_gemini',
      principalId: 'agent_gemini',
      roleId: 'AGENT',
      scope: { workspaceId: 'ws_infra', repositoryId: 'repo_k8s', taskId: 'task_001' },
      assignedAt: new Date().toISOString(),
      assignedBy: 'admin',
      status: 'ACTIVE',
    };
    await roleResolver.assignRole(assignment);
  });

  it('allows agent to report observation within assigned task scope', async () => {
    const secContext = await contextManager.createContext(agentPrincipal, {
      workspaceId: 'ws_infra',
      repositoryId: 'repo_k8s',
      taskId: 'task_001',
    });

    const result = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'REPORT',
      resourceType: 'OBSERVATION',
      scope: { workspaceId: 'ws_infra', repositoryId: 'repo_k8s', taskId: 'task_001' },
      context: secContext,
    });

    expect(result.allowed).toBe(true);
  });

  it('strictly rejects agent reporting observation for foreign task or repository', async () => {
    const secContext = await contextManager.createContext(agentPrincipal, {
      workspaceId: 'ws_infra',
      repositoryId: 'repo_k8s',
      taskId: 'task_001',
    });

    // Attempting to report on a different task task_002
    const foreignTask = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'REPORT',
      resourceType: 'OBSERVATION',
      scope: { workspaceId: 'ws_infra', repositoryId: 'repo_k8s', taskId: 'task_002' },
      context: secContext,
    });
    expect(foreignTask.allowed).toBe(false);
    expect(foreignTask.reason).toContain('cross-scope access denied');

    // Attempting to report on a different repository
    const foreignRepo = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'REPORT',
      resourceType: 'OBSERVATION',
      scope: { workspaceId: 'ws_infra', repositoryId: 'repo_secrets' },
      context: secContext,
    });
    expect(foreignRepo.allowed).toBe(false);
  });

  it('enforces anti-elevation: agent cannot assert system verification provenance directly', async () => {
    const secContext = await contextManager.createContext(agentPrincipal, {
      workspaceId: 'ws_infra',
      repositoryId: 'repo_k8s',
      taskId: 'task_001',
    });

    // Agent can report verification evidence
    const reportEvidence = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'REPORT',
      resourceType: 'VERIFICATION',
      scope: { workspaceId: 'ws_infra', repositoryId: 'repo_k8s', taskId: 'task_001' },
      context: secContext,
    });
    expect(reportEvidence.allowed).toBe(true);

    // Agent CANNOT administer or certify verification (action ADMINISTER on VERIFICATION is prohibited)
    const certifyAttempt = await authorizer.authorize({
      principal: agentPrincipal,
      action: 'ADMINISTER',
      resourceType: 'VERIFICATION',
      scope: { workspaceId: 'ws_infra', repositoryId: 'repo_k8s', taskId: 'task_001' },
      context: secContext,
    });
    expect(certifyAttempt.allowed).toBe(false);
  });
});
