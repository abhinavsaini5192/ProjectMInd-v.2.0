import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceService } from '../../src/workspace/services/WorkspaceService.js';
import { PersistentWorkspaceProjectRepository } from '../../src/workspace/persistence/PersistentWorkspaceProjectRepository.js';
import type { IEventBus } from '../../src/workspace/interfaces/IEventBus.js';
import type { SecurityContext } from '../../src/security/models/SecurityContext.js';
import { ScopeViolationError } from '../../src/security/errors/SecurityError.js';
import { ProjectMindError } from '../../src/errors/index.js';
import { StorageCoreError } from '../../src/storage/types/StorageErrors.js';

describe('Phase 9.2 - WorkspaceService', () => {
  let repository: PersistentWorkspaceProjectRepository;
  let eventBus: IEventBus;
  let publishedEvents: Array<{ eventName: string; payload: any }>;
  let service: WorkspaceService;

  beforeEach(() => {
    repository = new PersistentWorkspaceProjectRepository();
    publishedEvents = [];
    eventBus = {
      publish: vi.fn((eventName: string, payload: any) => {
        publishedEvents.push({ eventName, payload });
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    service = new WorkspaceService(repository, eventBus);
  });

  describe('createWorkspace', () => {
    it('creates a workspace with normalized slug, owner member, and emits workspace.created', async () => {
      const workspace = await service.createWorkspace({
        name: 'Acme Platform',
        description: 'Primary platform engineering workspace',
        ownerId: 'user_123',
        settings: {
          defaultContextLimit: 12000,
        },
      });

      expect(workspace.workspaceId).toMatch(/^ws_/);
      expect(workspace.name).toBe('Acme Platform');
      expect(workspace.slug).toBe('acme-platform');
      expect(workspace.status).toBe('ACTIVE');
      expect(workspace.version).toBe(1);
      expect(workspace.settings.defaultContextLimit).toBe(12000);

      // Verify owner was automatically added as member
      const members = await service.listMembers(workspace.workspaceId);
      expect(members.length).toBe(1);
      expect(members[0].principalId).toBe('user_123');
      expect(members[0].role).toBe('ADMIN');

      // Verify event was emitted
      expect(publishedEvents.some((e) => e.eventName === 'workspace.created')).toBe(true);
      const createdEvent = publishedEvents.find((e) => e.eventName === 'workspace.created');
      expect(createdEvent!.payload.scope.workspaceId).toBe(workspace.workspaceId);
      expect(createdEvent!.payload.data.name).toBe('Acme Platform');
    });

    it('rejects duplicate slug creation in the workspace repository', async () => {
      await service.createWorkspace({
        name: 'Shared Workspace',
        slug: 'shared-slug',
        ownerId: 'user_1',
      });

      await expect(
        service.createWorkspace({
          name: 'Another Shared Workspace',
          slug: 'shared-slug',
          ownerId: 'user_2',
        })
      ).rejects.toThrow(StorageCoreError);
    });
  });

  describe('getWorkspace and listWorkspaces', () => {
    it('retrieves workspace by ID and slug', async () => {
      const created = await service.createWorkspace({
        name: 'Dev Experience',
        slug: 'devex',
        ownerId: 'admin_1',
      });

      const byId = await service.getWorkspace(created.workspaceId);
      expect(byId.name).toBe('Dev Experience');

      const bySlug = await service.getWorkspaceBySlug('devex');
      expect(bySlug.workspaceId).toBe(created.workspaceId);
    });

    it('throws error when workspace not found', async () => {
      await expect(service.getWorkspace('ws_nonexistent')).rejects.toThrow(ProjectMindError);
      await expect(service.getWorkspaceBySlug('slug_nonexistent')).rejects.toThrow(ProjectMindError);
    });

    it('lists workspaces with status filtering', async () => {
      const ws1 = await service.createWorkspace({ name: 'Active 1' });
      const ws2 = await service.createWorkspace({ name: 'Active 2' });
      await service.archiveWorkspace(ws2.workspaceId);

      const activeList = await service.listWorkspaces('ACTIVE');
      expect(activeList.length).toBe(1);
      expect(activeList[0].workspaceId).toBe(ws1.workspaceId);

      const archivedList = await service.listWorkspaces('ARCHIVED');
      expect(archivedList.length).toBe(1);
      expect(archivedList[0].workspaceId).toBe(ws2.workspaceId);
    });

    it('respects SecurityContext workspace isolation when listing', async () => {
      const ws1 = await service.createWorkspace({ name: 'Tenant 1' });
      await service.createWorkspace({ name: 'Tenant 2' });

      const context: SecurityContext = {
        principal: {
          principalId: 'u1',
          type: 'USER',
          identityId: 'u1',
          status: 'ACTIVE',
          authenticationMethod: 'SESSION',
          createdAt: new Date().toISOString(),
          roles: ['DEVELOPER'],
          permissions: [],
        },
        workspaceId: ws1.workspaceId,
        securityLevel: 'LOW',
        scope: { workspaceId: ws1.workspaceId },
        authenticatedAt: new Date().toISOString(),
        permissions: [],
        capabilities: [],
        authenticationMethod: 'SESSION',
        trustLevel: 'UNTRUSTED',
        createdAt: new Date().toISOString(),
      };

      const result = await service.listWorkspaces(undefined, context);
      expect(result.length).toBe(1);
      expect(result[0].workspaceId).toBe(ws1.workspaceId);
    });
  });

  describe('updateWorkspace', () => {
    it('updates workspace metadata and increments version', async () => {
      const created = await service.createWorkspace({ name: 'Old Name' });

      const updated = await service.updateWorkspace(created.workspaceId, {
        name: 'New Name',
        description: 'Updated Description',
        settings: { defaultContextLimit: 8000 },
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('Updated Description');
      expect(updated.settings.defaultContextLimit).toBe(8000);
      expect(updated.version).toBe(2);

      expect(publishedEvents.some((e) => e.eventName === 'workspace.updated')).toBe(true);
    });

    it('prevents update on archived or deleted workspace', async () => {
      const created = await service.createWorkspace({ name: 'Target' });
      await service.archiveWorkspace(created.workspaceId);

      await expect(
        service.updateWorkspace(created.workspaceId, { name: 'Attempted Change' })
      ).rejects.toThrow(ProjectMindError);
    });
  });

  describe('workspace lifecycle: archive, restore, and delete', () => {
    it('supports full lifecycle transitions', async () => {
      const created = await service.createWorkspace({ name: 'Lifecycle WS' });
      expect(created.status).toBe('ACTIVE');

      const archived = await service.archiveWorkspace(created.workspaceId);
      expect(archived.status).toBe('ARCHIVED');
      expect(archived.version).toBe(2);
      expect(publishedEvents.some((e) => e.eventName === 'workspace.archived')).toBe(true);

      const restored = await service.restoreWorkspace(created.workspaceId);
      expect(restored.status).toBe('ACTIVE');
      expect(restored.version).toBe(3);
      expect(publishedEvents.some((e) => e.eventName === 'workspace.restored')).toBe(true);

      await service.deleteWorkspace(created.workspaceId);
      const deleted = await service.getWorkspace(created.workspaceId);
      expect(deleted.status).toBe('DELETED');
      expect(publishedEvents.some((e) => e.eventName === 'workspace.deleted')).toBe(true);
    });
  });

  describe('membership management', () => {
    it('adds, lists, and removes workspace members', async () => {
      const ws = await service.createWorkspace({ name: 'Member Test WS' });

      const member = await service.addMember({
        workspaceId: ws.workspaceId,
        principalId: 'developer_42',
        role: 'DEVELOPER',
      });

      expect(member.role).toBe('DEVELOPER');
      expect(member.workspaceId).toBe(ws.workspaceId);

      const list = await service.listMembers(ws.workspaceId);
      expect(list.length).toBe(2); // owner + developer_42

      await service.removeMember(ws.workspaceId, 'developer_42');
      const updatedList = await service.listMembers(ws.workspaceId);
      expect(updatedList.length).toBe(1);
      expect(updatedList.some((m) => m.principalId === 'developer_42')).toBe(false);
    });
  });

  describe('cross-workspace security assertions', () => {
    it('throws ScopeViolationError if securityContext workspace differs from target workspace', async () => {
      const ws1 = await service.createWorkspace({ name: 'Tenant A' });
      const ws2 = await service.createWorkspace({ name: 'Tenant B' });

      const securityContext: SecurityContext = {
        principal: {
          principalId: 'attacker',
          type: 'USER',
          identityId: 'attacker',
          status: 'ACTIVE',
          authenticationMethod: 'SESSION',
          createdAt: new Date().toISOString(),
          roles: ['DEVELOPER'],
          permissions: [],
        },
        workspaceId: ws1.workspaceId,
        securityLevel: 'LOW',
        scope: { workspaceId: ws1.workspaceId },
        authenticatedAt: new Date().toISOString(),
        permissions: [],
        capabilities: [],
        authenticationMethod: 'SESSION',
        trustLevel: 'UNTRUSTED',
        createdAt: new Date().toISOString(),
      };

      await expect(service.getWorkspace(ws2.workspaceId, securityContext)).rejects.toThrow(ScopeViolationError);
      await expect(
        service.updateWorkspace(ws2.workspaceId, { name: 'Compromised' }, securityContext)
      ).rejects.toThrow(ScopeViolationError);
    });
  });
});
