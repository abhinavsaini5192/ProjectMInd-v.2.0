import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from '../../src/workspace/services/ProjectService.js';
import { WorkspaceService } from '../../src/workspace/services/WorkspaceService.js';
import { PersistentWorkspaceProjectRepository } from '../../src/workspace/persistence/PersistentWorkspaceProjectRepository.js';
import type { IEventBus } from '../../src/workspace/interfaces/IEventBus.js';
import type { SecurityContext } from '../../src/security/models/SecurityContext.js';
import { ScopeViolationError } from '../../src/security/errors/SecurityError.js';
import { ProjectMindError } from '../../src/errors/index.js';
import { StorageCoreError } from '../../src/storage/types/StorageErrors.js';
import type { Workspace } from '../../src/workspace/models/Workspace.js';

describe('Phase 9.2 - ProjectService', () => {
  let repository: PersistentWorkspaceProjectRepository;
  let eventBus: IEventBus;
  let publishedEvents: Array<{ eventName: string; payload: any }>;
  let workspaceService: WorkspaceService;
  let projectService: ProjectService;
  let defaultWorkspace: Workspace;

  beforeEach(async () => {
    repository = new PersistentWorkspaceProjectRepository();
    publishedEvents = [];
    eventBus = {
      publish: vi.fn((eventName: string, payload: any) => {
        publishedEvents.push({ eventName, payload });
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    workspaceService = new WorkspaceService(repository, eventBus);
    projectService = new ProjectService(repository, repository, eventBus);

    defaultWorkspace = await workspaceService.createWorkspace({
      name: 'Default Workspace',
      slug: 'default-ws',
      ownerId: 'owner_1',
    });
  });

  describe('createProject', () => {
    it('creates a project with merged configuration defaults and emits project.created', async () => {
      const project = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Order Service',
        description: 'Microservice handling customer orders',
        projectType: 'SERVICE',
        settings: {
          context: { maxTokens: 16000 },
          features: { autoDiscover: true },
        },
      });

      expect(project.projectId).toMatch(/^proj_/);
      expect(project.workspaceId).toBe(defaultWorkspace.workspaceId);
      expect(project.name).toBe('Order Service');
      expect(project.slug).toBe('order-service');
      expect(project.status).toBe('ACTIVE');
      expect(project.version).toBe(1);
      expect(project.settings.context.maxTokens).toBe(16000);
      expect(project.settings.analysis.autoScan).toBe(true); // default preserved

      expect(publishedEvents.some((e) => e.eventName === 'project.created')).toBe(true);
      const event = publishedEvents.find((e) => e.eventName === 'project.created');
      expect(event!.payload.scope.projectId).toBe(project.projectId);
    });

    it('rejects project creation if parent workspace is missing or inactive', async () => {
      await expect(
        projectService.createProject({
          workspaceId: 'ws_missing',
          name: 'Orphan Project',
        })
      ).rejects.toThrow(ProjectMindError);

      await workspaceService.archiveWorkspace(defaultWorkspace.workspaceId);

      await expect(
        projectService.createProject({
          workspaceId: defaultWorkspace.workspaceId,
          name: 'Blocked Project',
        })
      ).rejects.toThrow(ProjectMindError);
    });

    it('rejects duplicate project slug within the same workspace', async () => {
      await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Billing System',
        slug: 'billing',
      });

      await expect(
        projectService.createProject({
          workspaceId: defaultWorkspace.workspaceId,
          name: 'Billing V2',
          slug: 'billing',
        })
      ).rejects.toThrow(StorageCoreError);
    });
  });

  describe('repository association', () => {
    it('attaches and detaches repositories, maintaining primary repository identity', async () => {
      const project = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Monorepo Suite',
      });

      // Attach repo 1
      const assoc1 = await projectService.attachRepository({
        projectId: project.projectId,
        workspaceId: defaultWorkspace.workspaceId,
        repositoryId: 'repo_backend',
        repositoryPath: '/repos/backend',
        isPrimary: true,
      });

      expect(assoc1.repositoryId).toBe('repo_backend');
      expect(assoc1.isPrimary).toBe(true);

      // Attach repo 2
      const assoc2 = await projectService.attachRepository({
        projectId: project.projectId,
        workspaceId: defaultWorkspace.workspaceId,
        repositoryId: 'repo_frontend',
        repositoryPath: '/repos/frontend',
        isPrimary: false,
      });

      const updatedProject = await projectService.getProject(project.projectId);
      expect(updatedProject.repositoryIds).toEqual(['repo_backend', 'repo_frontend']);
      expect(updatedProject.primaryRepositoryId).toBe('repo_backend');

      const repoList = await projectService.listRepositories(project.projectId);
      expect(repoList.length).toBe(2);

      // Detach repo 2
      await projectService.detachRepository(project.projectId, 'repo_frontend');
      const afterDetach = await projectService.getProject(project.projectId);
      expect(afterDetach.repositoryIds).toEqual(['repo_backend']);

      expect(publishedEvents.some((e) => e.eventName === 'project.repository.attached')).toBe(true);
      expect(publishedEvents.some((e) => e.eventName === 'project.repository.detached')).toBe(true);
    });

    it('prevents attaching a repository already bound to another project', async () => {
      const projA = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Project A',
      });
      const projB = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Project B',
      });

      await projectService.attachRepository({
        projectId: projA.projectId,
        workspaceId: defaultWorkspace.workspaceId,
        repositoryId: 'shared_repo',
      });

      await expect(
        projectService.attachRepository({
          projectId: projB.projectId,
          workspaceId: defaultWorkspace.workspaceId,
          repositoryId: 'shared_repo',
        })
      ).rejects.toThrow(ProjectMindError);
    });

    it('prevents attaching a repository to a project in a different workspace', async () => {
      const otherWs = await workspaceService.createWorkspace({ name: 'Other Workspace' });
      const projInOther = await projectService.createProject({
        workspaceId: otherWs.workspaceId,
        name: 'Other Project',
      });

      await expect(
        projectService.attachRepository({
          projectId: projInOther.projectId,
          workspaceId: defaultWorkspace.workspaceId, // Mismatched workspace
          repositoryId: 'test_repo',
        })
      ).rejects.toThrow(ScopeViolationError);
    });
  });

  describe('project lifecycle', () => {
    it('manages project status transitions: ACTIVE -> ARCHIVED -> ACTIVE', async () => {
      const project = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Lifecycle Target',
      });
      expect(project.status).toBe('ACTIVE');

      const archived = await projectService.archiveProject(project.projectId);
      expect(archived.status).toBe('ARCHIVED');
      expect(archived.version).toBe(2);
      expect(publishedEvents.some((e) => e.eventName === 'project.archived')).toBe(true);

      const restored = await projectService.restoreProject(project.projectId);
      expect(restored.status).toBe('ACTIVE');
      expect(restored.version).toBe(3);
      expect(publishedEvents.some((e) => e.eventName === 'project.restored')).toBe(true);
    });

    it('prevents updates on archived projects', async () => {
      const project = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Read Only Target',
      });
      await projectService.archiveProject(project.projectId);

      await expect(
        projectService.updateProject(project.projectId, { name: 'Attempted Change' })
      ).rejects.toThrow(ProjectMindError);
    });
  });

  describe('resolveProjectContext', () => {
    it('deterministically resolves ProjectContext by explicit project ID', async () => {
      const project = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Contextual Service',
        primaryRepositoryId: 'repo_main',
      });

      const resolved = await projectService.resolveProjectContext({
        explicitProjectId: project.projectId,
      });

      expect(resolved.projectId).toBe(project.projectId);
      expect(resolved.workspaceId).toBe(defaultWorkspace.workspaceId);
      expect(resolved.repositoryId).toBe('repo_main');
      expect(resolved.configurationVersion).toBe(project.version);
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('resolves ProjectContext by repository association when projectId is omitted', async () => {
      const project = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Auto Discovered Service',
      });

      await projectService.attachRepository({
        projectId: project.projectId,
        workspaceId: defaultWorkspace.workspaceId,
        repositoryId: 'repo_auto_lookup',
        isPrimary: true,
      });

      const resolved = await projectService.resolveProjectContext({
        explicitRepositoryId: 'repo_auto_lookup',
      });

      expect(resolved.projectId).toBe(project.projectId);
      expect(resolved.workspaceId).toBe(defaultWorkspace.workspaceId);
      expect(resolved.repositoryId).toBe('repo_auto_lookup');
    });

    it('provides safe fallback ProjectContext when repository is unmanaged', async () => {
      const resolved = await projectService.resolveProjectContext({
        repositoryPath: '/unregistered/local/dir',
      });

      expect(resolved.workspaceId).toBe('default');
      expect(resolved.projectId).toBe('proj_default');
      expect(resolved.repositoryId).toBe('default');
      expect(resolved.repositoryPath).toBe('/unregistered/local/dir');
    });
  });

  describe('security scoping', () => {
    it('prevents cross-project access when securityContext specifies a different project', async () => {
      const projA = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Project A',
      });
      const projB = await projectService.createProject({
        workspaceId: defaultWorkspace.workspaceId,
        name: 'Project B',
      });

      const securityContext: SecurityContext = {
        principal: {
          principalId: 'developer',
          type: 'USER',
          identityId: 'developer',
          status: 'ACTIVE',
          authenticationMethod: 'SESSION',
          createdAt: new Date().toISOString(),
          roles: ['DEVELOPER'],
          permissions: [],
        },
        workspaceId: defaultWorkspace.workspaceId,
        projectId: projA.projectId,
        securityLevel: 'LOW',
        scope: { workspaceId: defaultWorkspace.workspaceId, projectId: projA.projectId },
        authenticatedAt: new Date().toISOString(),
        permissions: [],
        capabilities: [],
        authenticationMethod: 'SESSION',
        trustLevel: 'UNTRUSTED',
        createdAt: new Date().toISOString(),
      };

      // Allowed access to own project
      const allowed = await projectService.getProject(projA.projectId, securityContext);
      expect(allowed.projectId).toBe(projA.projectId);

      // Denied access to other project in same workspace
      await expect(projectService.getProject(projB.projectId, securityContext)).rejects.toThrow(
        ScopeViolationError
      );
    });
  });
});
