import { describe, it, expect, beforeEach } from 'vitest';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { ScopeViolationError } from '../../src/security/errors/SecurityError.js';
import { SECURITY_EVENTS } from '../../src/security/events/SecurityEvents.js';
import type { ResourceScope } from '../../src/security/models/ResourceScope.js';

describe('Phase 8.2 Security — ScopeValidator & Hierarchical Isolation', () => {
  let scopeValidator: ScopeValidator;
  let eventBus: NodeEventBus;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    scopeValidator = new ScopeValidator(eventBus);
  });

  it('allows any request scope when authorized scope is global', () => {
    const authorizedScope: ResourceScope = { global: true };
    const requestScope: ResourceScope = {
      workspaceId: 'ws_finance',
      repositoryId: 'repo_ledger',
      taskId: 'task_100',
    };

    expect(scopeValidator.isScopeAllowed(requestScope, authorizedScope)).toBe(true);
    expect(() => scopeValidator.validateScope(requestScope, authorizedScope)).not.toThrow();
  });

  it('allows access when workspace and repository match', () => {
    const authorizedScope: ResourceScope = {
      workspaceId: 'ws_finance',
      repositoryId: 'repo_ledger',
    };
    const requestScope: ResourceScope = {
      workspaceId: 'ws_finance',
      repositoryId: 'repo_ledger',
      taskId: 'task_100',
    };

    expect(scopeValidator.isScopeAllowed(requestScope, authorizedScope)).toBe(true);
    expect(() => scopeValidator.validateScope(requestScope, authorizedScope)).not.toThrow();
  });

  it('rejects cross-workspace access and emits SECURITY_VIOLATION_DETECTED', () => {
    const authorizedScope: ResourceScope = {
      workspaceId: 'ws_finance',
    };
    const requestScope: ResourceScope = {
      workspaceId: 'ws_marketing',
      repositoryId: 'repo_campaigns',
    };

    let violationEmitted = false;
    eventBus.subscribe(SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED, (event: any) => {
      expect(event.payload.violationType).toBe('CROSS_WORKSPACE_ACCESS');
      expect(event.payload.targetScope.workspaceId).toBe('ws_marketing');
      violationEmitted = true;
    });

    expect(scopeValidator.isScopeAllowed(requestScope, authorizedScope)).toBe(false);
    expect(() => scopeValidator.validateScope(requestScope, authorizedScope)).toThrow(ScopeViolationError);
    expect(violationEmitted).toBe(true);
  });

  it('rejects cross-repository access within the same workspace when bounded to specific repo', () => {
    const authorizedScope: ResourceScope = {
      workspaceId: 'ws_finance',
      repositoryId: 'repo_ledger',
    };
    const requestScope: ResourceScope = {
      workspaceId: 'ws_finance',
      repositoryId: 'repo_payroll',
    };

    let violationEmitted = false;
    eventBus.subscribe(SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED, (event: any) => {
      expect(event.payload.violationType).toBe('CROSS_REPOSITORY_ACCESS');
      expect(event.payload.targetScope.repositoryId).toBe('repo_payroll');
      violationEmitted = true;
    });

    expect(scopeValidator.isScopeAllowed(requestScope, authorizedScope)).toBe(false);
    expect(() => scopeValidator.validateScope(requestScope, authorizedScope)).toThrow(ScopeViolationError);
    expect(violationEmitted).toBe(true);
  });

  it('rejects cross-task access when authorized scope is scoped to a specific task', () => {
    const authorizedScope: ResourceScope = {
      workspaceId: 'ws_finance',
      repositoryId: 'repo_ledger',
      taskId: 'task_alpha',
    };
    const requestScope: ResourceScope = {
      workspaceId: 'ws_finance',
      repositoryId: 'repo_ledger',
      taskId: 'task_beta',
    };

    expect(scopeValidator.isScopeAllowed(requestScope, authorizedScope)).toBe(false);
    expect(() => scopeValidator.validateScope(requestScope, authorizedScope)).toThrow(ScopeViolationError);
  });
});
