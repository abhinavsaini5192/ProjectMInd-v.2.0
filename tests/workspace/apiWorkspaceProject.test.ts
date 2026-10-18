import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { WorkspaceController } from '../../src/api/controllers/WorkspaceController.js';
import { ProjectController } from '../../src/api/controllers/ProjectController.js';
import { PersistentWorkspaceProjectRepository } from '../../src/workspace/persistence/PersistentWorkspaceProjectRepository.js';
import { WorkspaceService } from '../../src/workspace/services/WorkspaceService.js';
import { ProjectService } from '../../src/workspace/services/ProjectService.js';

describe('Phase 9.2 - API Workspace & Project Integration', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let sharedRepo: PersistentWorkspaceProjectRepository;
  let workspaceService: WorkspaceService;
  let projectService: ProjectService;
  let workspaceController: WorkspaceController;
  let projectController: ProjectController;

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();

    sharedRepo = new PersistentWorkspaceProjectRepository();
    workspaceService = new WorkspaceService(sharedRepo);
    projectService = new ProjectService(sharedRepo, sharedRepo);

    workspaceController = new WorkspaceController(workspaceService);
    projectController = new ProjectController(projectService);

    workspaceController.registerRoutes(router);
    projectController.registerRoutes(router);
  });

  describe('WorkspaceController Endpoints', () => {
    it('creates, retrieves, updates, archives, restores, and manages members for workspaces', async () => {
      // 1. Create Workspace
      const createReq = requestService.createRequest({
        path: '/v1/workspaces',
        method: 'POST',
        body: {
          name: 'Acme Cloud',
          description: 'Acme Cloud Workspace',
          settings: { defaultContextLimit: 8000 },
        },
      });
      const createRes = await router.handle(createReq);
      expect(createRes.status).toBe(201);
      const ws = createRes.data as any;
      expect(ws.workspaceId).toMatch(/^ws_/);
      expect(ws.slug).toBe('acme-cloud');

      // 2. List Workspaces
      const listReq = requestService.createRequest({
        path: '/v1/workspaces',
        method: 'GET',
      });
      const listRes = await router.handle(listReq);
      expect(listRes.status).toBe(200);
      expect((listRes.data as any[]).length).toBe(1);

      // 3. Get Workspace
      const getReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}`,
        method: 'GET',
      });
      const getRes = await router.handle(getReq);
      expect(getRes.status).toBe(200);
      expect((getRes.data as any).name).toBe('Acme Cloud');

      // 4. Update Workspace
      const updateReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}`,
        method: 'PATCH',
        body: { name: 'Acme Cloud Enterprise' },
      });
      const updateRes = await router.handle(updateReq);
      expect(updateRes.status).toBe(200);
      expect((updateRes.data as any).name).toBe('Acme Cloud Enterprise');

      // 5. Add Member
      const memberReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}/members`,
        method: 'POST',
        body: { principalId: 'engineer_bob', role: 'DEVELOPER' },
      });
      const memberRes = await router.handle(memberReq);
      expect(memberRes.status).toBe(201);

      // 6. List Members
      const listMembersReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}/members`,
        method: 'GET',
      });
      const listMembersRes = await router.handle(listMembersReq);
      expect(listMembersRes.status).toBe(200);
      expect((listMembersRes.data as any[]).some((m) => m.principalId === 'engineer_bob')).toBe(true);

      // 7. Archive Workspace
      const archiveReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}/archive`,
        method: 'POST',
      });
      const archiveRes = await router.handle(archiveReq);
      expect(archiveRes.status).toBe(200);
      expect((archiveRes.data as any).status).toBe('ARCHIVED');

      // 8. Restore Workspace
      const restoreReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}/restore`,
        method: 'POST',
      });
      const restoreRes = await router.handle(restoreReq);
      expect(restoreRes.status).toBe(200);
      expect((restoreRes.data as any).status).toBe('ACTIVE');
    });
  });

  describe('ProjectController Endpoints', () => {
    it('creates, attaches repos, resolves context, and manages project lifecycle', async () => {
      // Create Workspace first
      const ws = await workspaceService.createWorkspace({ name: 'Integration WS' });

      // 1. Create Project
      const createProjReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}/projects`,
        method: 'POST',
        body: {
          name: 'Payment Service',
          projectType: 'SERVICE',
          settings: { context: { defaultTokenBudget: 6000 } },
        },
      });
      const createProjRes = await router.handle(createProjReq);
      expect(createProjRes.status).toBe(201);
      const proj = createProjRes.data as any;
      expect(proj.projectId).toMatch(/^proj_/);
      expect(proj.workspaceId).toBe(ws.workspaceId);

      // 2. List Projects in Workspace
      const listProjReq = requestService.createRequest({
        path: `/v1/workspaces/${ws.workspaceId}/projects`,
        method: 'GET',
      });
      const listProjRes = await router.handle(listProjReq);
      expect(listProjRes.status).toBe(200);
      expect((listProjRes.data as any[]).length).toBe(1);

      // 3. Attach Repository
      const attachReq = requestService.createRequest({
        path: `/v1/projects/${proj.projectId}/repositories`,
        method: 'POST',
        body: {
          workspaceId: ws.workspaceId,
          repositoryId: 'repo_billing_core',
          repositoryPath: '/repos/billing',
          isPrimary: true,
        },
      });
      const attachRes = await router.handle(attachReq);
      expect(attachRes.status).toBe(201);
      expect((attachRes.data as any).repositoryId).toBe('repo_billing_core');

      // 4. List Repositories
      const listReposReq = requestService.createRequest({
        path: `/v1/projects/${proj.projectId}/repositories`,
        method: 'GET',
      });
      const listReposRes = await router.handle(listReposReq);
      expect(listReposRes.status).toBe(200);
      expect((listReposRes.data as any[]).length).toBe(1);

      // 5. Resolve Project Context
      const contextReq = requestService.createRequest({
        path: `/v1/projects/${proj.projectId}/context`,
        method: 'GET',
      });
      const contextRes = await router.handle(contextReq);
      expect(contextRes.status).toBe(200);
      const projectCtx = contextRes.data as any;
      expect(projectCtx.projectId).toBe(proj.projectId);
      expect(projectCtx.workspaceId).toBe(ws.workspaceId);
      expect(projectCtx.repositoryId).toBe('repo_billing_core');
      expect(projectCtx.settings).toBeDefined();

      // 6. Detach Repository
      const detachReq = requestService.createRequest({
        path: `/v1/projects/${proj.projectId}/repositories/repo_billing_core`,
        method: 'DELETE',
      });
      const detachRes = await router.handle(detachReq);
      expect(detachRes.status).toBe(204);

      // 7. Project Lifecycle: Archive and Restore
      const archiveReq = requestService.createRequest({
        path: `/v1/projects/${proj.projectId}/archive`,
        method: 'POST',
      });
      const archiveRes = await router.handle(archiveReq);
      expect(archiveRes.status).toBe(200);
      expect((archiveRes.data as any).status).toBe('ARCHIVED');

      const restoreReq = requestService.createRequest({
        path: `/v1/projects/${proj.projectId}/restore`,
        method: 'POST',
      });
      const restoreRes = await router.handle(restoreReq);
      expect(restoreRes.status).toBe(200);
      expect((restoreRes.data as any).status).toBe('ACTIVE');
    });
  });
});
