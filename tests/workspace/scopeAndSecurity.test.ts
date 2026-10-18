import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isScopeContainedWithin, formatScope, type ResourceScope } from '../../src/security/models/ResourceScope.js';
import { ScopeValidator } from '../../src/security/core/ScopeValidator.js';
import { ScopeViolationError } from '../../src/security/errors/SecurityError.js';
import { SECURITY_EVENTS } from '../../src/security/events/SecurityEvents.js';
import type { IEventBus } from '../../src/events/index.js';

describe('Phase 9.2 - Scope and Security Integration', () => {
  let eventBus: IEventBus;
  let publishedEvents: Array<{ eventName: string; payload: any }>;
  let validator: ScopeValidator;

  beforeEach(() => {
    publishedEvents = [];
    eventBus = {
      publish: vi.fn((eventName: string, payload: any) => {
        publishedEvents.push({ eventName, payload });
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as IEventBus;
    validator = new ScopeValidator(eventBus);
  });

  describe('ResourceScope hierarchy and containment', () => {
    it('formats scope correctly across workspace, project, and repository levels', () => {
      const globalScope: ResourceScope = { global: true };
      expect(formatScope(globalScope)).toBe('global');

      const workspaceScope: ResourceScope = { workspaceId: 'ws_alpha' };
      expect(formatScope(workspaceScope)).toBe('ws:ws_alpha');

      const projectScope: ResourceScope = { workspaceId: 'ws_alpha', projectId: 'proj_checkout' };
      expect(formatScope(projectScope)).toBe('ws:ws_alpha/proj:proj_checkout');

      const repoScope: ResourceScope = {
        workspaceId: 'ws_alpha',
        projectId: 'proj_checkout',
        repositoryId: 'repo_gateway',
      };
      expect(formatScope(repoScope)).toBe('ws:ws_alpha/proj:proj_checkout/repo:repo_gateway');
    });

    it('enforces hierarchical containment: global permits all scopes', () => {
      const authorized: ResourceScope = { global: true };
      const request: ResourceScope = { workspaceId: 'ws_alpha', projectId: 'proj_1', repositoryId: 'repo_1' };

      expect(isScopeContainedWithin(request, authorized)).toBe(true);
    });

    it('enforces workspace boundary containment', () => {
      const authorized: ResourceScope = { workspaceId: 'ws_alpha' };

      // Matching workspace with project
      expect(isScopeContainedWithin({ workspaceId: 'ws_alpha', projectId: 'proj_1' }, authorized)).toBe(true);

      // Different workspace is rejected
      expect(isScopeContainedWithin({ workspaceId: 'ws_beta', projectId: 'proj_1' }, authorized)).toBe(false);

      // Missing workspace on request is rejected
      expect(isScopeContainedWithin({ projectId: 'proj_1' }, authorized)).toBe(false);
    });

    it('enforces project boundary containment within the same workspace', () => {
      const authorized: ResourceScope = { workspaceId: 'ws_alpha', projectId: 'proj_orders' };

      // Same project and repository is allowed
      expect(
        isScopeContainedWithin(
          { workspaceId: 'ws_alpha', projectId: 'proj_orders', repositoryId: 'repo_orders_api' },
          authorized
        )
      ).toBe(true);

      // Different project within same workspace is rejected
      expect(
        isScopeContainedWithin(
          { workspaceId: 'ws_alpha', projectId: 'proj_billing', repositoryId: 'repo_billing_api' },
          authorized
        )
      ).toBe(false);
    });
  });

  describe('ScopeValidator enforcement & security violations', () => {
    it('detects and emits CROSS_WORKSPACE_ACCESS security violation event', () => {
      const authorized: ResourceScope = { workspaceId: 'ws_tenant_a' };
      const request: ResourceScope = { workspaceId: 'ws_tenant_b', projectId: 'proj_1' };

      expect(() => validator.validateScope(request, authorized)).toThrow(ScopeViolationError);

      expect(publishedEvents.some((e) => e.eventName === SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED)).toBe(true);
      const violation = publishedEvents.find((e) => e.eventName === SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED);
      expect(violation!.payload.violationType).toBe('CROSS_WORKSPACE_ACCESS');
      expect(violation!.payload.targetScope.workspaceId).toBe('ws_tenant_b');
    });

    it('detects and emits CROSS_PROJECT_ACCESS security violation event', () => {
      const authorized: ResourceScope = { workspaceId: 'ws_tenant_a', projectId: 'proj_secure_a' };
      const request: ResourceScope = { workspaceId: 'ws_tenant_a', projectId: 'proj_secure_b' };

      expect(() => validator.validateScope(request, authorized)).toThrow(ScopeViolationError);

      expect(publishedEvents.some((e) => e.eventName === SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED)).toBe(true);
      const violation = publishedEvents.find((e) => e.eventName === SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED);
      expect(violation!.payload.violationType).toBe('CROSS_PROJECT_ACCESS');
      expect(violation!.payload.targetScope.projectId).toBe('proj_secure_b');
    });

    it('detects and emits CROSS_REPOSITORY_ACCESS security violation event', () => {
      const authorized: ResourceScope = {
        workspaceId: 'ws_tenant_a',
        projectId: 'proj_secure_a',
        repositoryId: 'repo_backend',
      };
      const request: ResourceScope = {
        workspaceId: 'ws_tenant_a',
        projectId: 'proj_secure_a',
        repositoryId: 'repo_frontend',
      };

      expect(() => validator.validateScope(request, authorized)).toThrow(ScopeViolationError);

      const violation = publishedEvents.find((e) => e.eventName === SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED);
      expect(violation!.payload.violationType).toBe('CROSS_REPOSITORY_ACCESS');
    });

    it('allows valid in-scope requests without throwing or emitting violation events', () => {
      const authorized: ResourceScope = { workspaceId: 'ws_tenant_a', projectId: 'proj_1' };
      const request: ResourceScope = {
        workspaceId: 'ws_tenant_a',
        projectId: 'proj_1',
        repositoryId: 'repo_main',
      };

      expect(() => validator.validateScope(request, authorized)).not.toThrow();
      expect(publishedEvents.length).toBe(0);
    });
  });
});
