import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { CollaborationController } from '../../src/api/controllers/CollaborationController.js';
import { CollaborationManager } from '../../src/agent/collaboration/services/CollaborationManager.js';
import { InMemoryCollaborationStore } from '../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../src/agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../src/agent/collaboration/services/HandoffCoordinator.js';
import { AgentRegistry } from '../../src/agent/runtime/AgentRegistry.js';
import { InMemoryProjectMemoryStore } from '../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { ProjectMemoryManager } from '../../src/memory/project/services/ProjectMemoryManager.js';
import { ApiError } from '../../src/api/errors/ApiError.js';

describe('Collaboration API Controller Suite (Phase 9.5)', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let store: InMemoryCollaborationStore;
  let reservationService: ResourceReservationService;
  let conflictDetector: ConflictDetector;
  let handoffCoordinator: HandoffCoordinator;
  let memoryStore: InMemoryProjectMemoryStore;
  let memoryManager: ProjectMemoryManager;
  let manager: CollaborationManager;
  let controller: CollaborationController;
  let agentRegistry: AgentRegistry;

  const workspaceId = 'ws_collab_api';
  const projectId = 'proj_collab_api';

  beforeEach(async () => {
    router = new ApiRouter();
    requestService = new RequestService();

    store = new InMemoryCollaborationStore();
    reservationService = new ResourceReservationService(store);
    conflictDetector = new ConflictDetector(store);
    handoffCoordinator = new HandoffCoordinator(store);
    agentRegistry = new AgentRegistry();
    memoryStore = new InMemoryProjectMemoryStore();
    memoryManager = new ProjectMemoryManager(memoryStore);

    // Register active agents in AgentRegistry
    await agentRegistry.register({
      agentId: 'agent_coord',
      name: 'Coordinator Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });
    await agentRegistry.register({
      agentId: 'agent_backend',
      name: 'Backend Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });
    await agentRegistry.register({
      agentId: 'agent_frontend',
      name: 'Frontend Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });

    manager = new CollaborationManager(
      store,
      reservationService,
      conflictDetector,
      handoffCoordinator,
      undefined, // contextService
      agentRegistry,
      undefined, // eventBus
      memoryManager
    );

    controller = new CollaborationController(manager);
    controller.registerRoutes(router);
  });

  const setupSecurity = (req: any, ws = workspaceId, proj = projectId, isAdmin = false) => {
    req.context.workspaceId = ws;
    (req.context as any).projectId = proj;
    (req.context as any).securityContext = {
      workspaceId: ws,
      projectId: proj,
      isGlobalAdmin: () => isAdmin,
    };
  };

  describe('Session Lifecycle Endpoints', () => {
    it('creates a collaboration session successfully (POST /collaborations)', async () => {
      const req = requestService.createRequest({
        method: 'POST',
        path: '/collaborations',
        body: {
          workspaceId,
          projectId,
          title: 'API Authentication Overhaul',
          coordinatorAgentId: 'agent_coord',
          repositoryIds: ['repo_backend'],
          description: 'Multi-agent auth refactor',
        },
      });
      setupSecurity(req);

      const res = await router.handle(req);
      expect(res.status).toBe(201);
      const data = res.data as any;
      expect(data.collaborationSessionId).toBeDefined();
      expect(data.title).toBe('API Authentication Overhaul');
      expect(data.status).toBe('ACTIVE');
      expect(data.participants.length).toBe(1);
      expect(data.participants[0].agentId).toBe('agent_coord');
    });

    it('rejects session creation missing required fields', async () => {
      const req = requestService.createRequest({
        method: 'POST',
        path: '/collaborations',
        body: {
          title: 'Missing Coordinator',
        },
      });
      setupSecurity(req);

      await expect(router.handle(req)).rejects.toThrow(ApiError);
    });

    it('retrieves an existing collaboration session (GET /collaborations/:id)', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Query Test',
        coordinatorAgentId: 'agent_coord',
      });

      const req = requestService.createRequest({
        method: 'GET',
        path: `/collaborations/${session.collaborationSessionId}`,
      });
      setupSecurity(req);

      const res = await router.handle(req);
      expect(res.status).toBe(200);
      const data = res.data as any;
      expect(data.collaborationSessionId).toBe(session.collaborationSessionId);
    });

    it('lists sessions matching scope (GET /collaborations)', async () => {
      await manager.createSession({
        workspaceId,
        projectId,
        title: 'Session Alpha',
        coordinatorAgentId: 'agent_coord',
      });

      const req = requestService.createRequest({
        method: 'GET',
        path: '/collaborations',
        query: {
          workspaceId,
          projectId,
        },
      });
      setupSecurity(req);

      const res = await router.handle(req);
      expect(res.status).toBe(200);
      const data = res.data as any;
      expect(data.count).toBe(1);
      expect(data.sessions[0].title).toBe('Session Alpha');
    });

    it('updates session status (PATCH /collaborations/:id/status)', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Pause Test',
        coordinatorAgentId: 'agent_coord',
      });

      const req = requestService.createRequest({
        method: 'PATCH',
        path: `/collaborations/${session.collaborationSessionId}/status`,
        body: { status: 'PAUSED' },
      });
      setupSecurity(req);

      const res = await router.handle(req);
      expect(res.status).toBe(200);
      const data = res.data as any;
      expect(data.status).toBe('PAUSED');
    });
  });

  describe('Participants Endpoints', () => {
    it('adds and removes a participant', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Team Collaboration',
        coordinatorAgentId: 'agent_coord',
      });

      // Join backend agent
      const joinReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/participants`,
        body: {
          agentId: 'agent_backend',
          role: 'IMPLEMENTER',
          capabilities: ['typescript'],
        },
      });
      setupSecurity(joinReq);

      const joinRes = await router.handle(joinReq);
      expect(joinRes.status).toBe(201);
      const joinData = joinRes.data as any;
      expect(joinData.agentId).toBe('agent_backend');
      expect(joinData.role).toBe('IMPLEMENTER');

      // Leave backend agent
      const leaveReq = requestService.createRequest({
        method: 'DELETE',
        path: `/collaborations/${session.collaborationSessionId}/participants/agent_backend`,
      });
      setupSecurity(leaveReq);

      const leaveRes = await router.handle(leaveReq);
      expect(leaveRes.status).toBe(200);
      const leaveData = leaveRes.data as any;
      expect(leaveData.removed).toBe(true);
    });
  });

  describe('Task Assignment Endpoints', () => {
    it('assigns and unassigns tasks', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Task Assignment Test',
        coordinatorAgentId: 'agent_coord',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend',
        role: 'IMPLEMENTER',
        capabilities: ['typescript'],
      });

      // Assign task
      const assignReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/tasks/assign`,
        body: {
          taskId: 'task_auth_backend',
          agentId: 'agent_backend',
        },
      });
      setupSecurity(assignReq);

      const assignRes = await router.handle(assignReq);
      expect(assignRes.status).toBe(200);
      const assignData = assignRes.data as any;
      expect(assignData.ownerAgentId).toBe('agent_backend');

      // Unassign task
      const unassignReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/tasks/unassign`,
        body: {
          taskId: 'task_auth_backend',
        },
      });
      setupSecurity(unassignReq);

      const unassignRes = await router.handle(unassignReq);
      expect(unassignRes.status).toBe(200);
      const unassignData = unassignRes.data as any;
      expect(unassignData.unassigned).toBe(true);
    });
  });

  describe('Resource Reservations & Conflicts Endpoints', () => {
    it('reserves a resource and releases it via API', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Reservation Test',
        coordinatorAgentId: 'agent_coord',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend',
        role: 'IMPLEMENTER',
      });

      const reserveReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/reservations`,
        body: {
          ownerAgentId: 'agent_backend',
          resourceType: 'FILE',
          resourceId: 'src/api/auth.ts',
          ttlMs: 30000,
        },
      });
      setupSecurity(reserveReq);

      const reserveRes = await router.handle(reserveReq);
      expect(reserveRes.status).toBe(201);
      const resvData = reserveRes.data as any;
      const resvId = resvData.reservationId;
      expect(resvId).toBeDefined();

      // Release reservation
      const releaseReq = requestService.createRequest({
        method: 'DELETE',
        path: `/collaborations/${session.collaborationSessionId}/reservations/${resvId}`,
        query: {
          agentId: 'agent_backend',
        },
      });
      setupSecurity(releaseReq);

      const releaseRes = await router.handle(releaseReq);
      expect(releaseRes.status).toBe(200);
      const releaseData = releaseRes.data as any;
      expect(releaseData.released).toBe(true);
    });

    it('queries conflicts for a collaboration session', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Conflict Query Test',
        coordinatorAgentId: 'agent_coord',
      });

      const conflictReq = requestService.createRequest({
        method: 'GET',
        path: `/collaborations/${session.collaborationSessionId}/conflicts`,
      });
      setupSecurity(conflictReq);

      const conflictRes = await router.handle(conflictReq);
      expect(conflictRes.status).toBe(200);
      const conflictData = conflictRes.data as any;
      expect(conflictData.count).toBe(0);
      expect(conflictData.conflicts).toEqual([]);
    });
  });

  describe('Handoffs Endpoints', () => {
    it('proposes, accepts, and rejects handoffs', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Handoff Pipeline',
        coordinatorAgentId: 'agent_coord',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend',
        role: 'IMPLEMENTER',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_frontend',
        role: 'IMPLEMENTER',
      });

      await manager.assignTask(session.collaborationSessionId, 'task_pipeline', 'agent_backend');

      // Propose handoff
      const proposeReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/handoffs`,
        body: {
          sourceAgentId: 'agent_backend',
          targetAgentId: 'agent_frontend',
          taskId: 'task_pipeline',
          summary: 'Backend API ready for client consumption',
          completedWork: ['REST schemas', 'auth tokens'],
          remainingWork: ['React components'],
          changedResources: ['src/api/auth.ts'],
        },
      });
      setupSecurity(proposeReq);

      const proposeRes = await router.handle(proposeReq);
      expect(proposeRes.status).toBe(201);
      const proposeData = proposeRes.data as any;
      const handoffId = proposeData.handoffId;
      expect(handoffId).toBeDefined();

      // Accept handoff
      const acceptReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/handoffs/${handoffId}/accept`,
        body: {
          acceptingAgentId: 'agent_frontend',
        },
      });
      setupSecurity(acceptReq);

      const acceptRes = await router.handle(acceptReq);
      expect(acceptRes.status).toBe(200);
      const acceptData = acceptRes.data as any;
      expect(acceptData.status).toBe('ACCEPTED');
    });
  });

  describe('Messages & Decisions Endpoints', () => {
    it('sends and lists structured collaboration messages', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Messaging Test',
        coordinatorAgentId: 'agent_coord',
      });

      const msgReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/messages`,
        body: {
          senderAgentId: 'agent_coord',
          type: 'INFORMATION',
          payload: { text: 'Session initialized and ready.' },
          correlationId: 'corr_init_1',
        },
      });
      setupSecurity(msgReq);

      const msgRes = await router.handle(msgReq);
      expect(msgRes.status).toBe(201);
      const msgData = msgRes.data as any;
      expect(msgData.messageId).toBeDefined();

      const listReq = requestService.createRequest({
        method: 'GET',
        path: `/collaborations/${session.collaborationSessionId}/messages`,
      });
      setupSecurity(listReq);

      const listRes = await router.handle(listReq);
      expect(listRes.status).toBe(200);
      const listData = listRes.data as any;
      expect(listData.count).toBe(1);
    });

    it('records and promotes decisions with governance', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Decision Test',
        coordinatorAgentId: 'agent_coord',
      });

      const decReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/decisions`,
        body: {
          decision: 'Use JWT bearer tokens for session auth',
          rationaleSummary: 'Stateless and horizontally scalable',
          proposedByAgentId: 'agent_coord',
          authority: 'AGENT_PROPOSED',
        },
      });
      setupSecurity(decReq);

      const decRes = await router.handle(decReq);
      expect(decRes.status).toBe(201);
      const decData = decRes.data as any;
      const decId = decData.decisionId;

      const promoteReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/decisions/${decId}/promote`,
        body: {
          targetAuthority: 'TEAM_ACCEPTED',
        },
      });
      setupSecurity(promoteReq);

      const promoteRes = await router.handle(promoteReq);
      expect(promoteRes.status).toBe(200);
      const promoteData = promoteRes.data as any;
      expect(promoteData.memoryId).toBeDefined();
    });
  });

  describe('Checkpoints & Security Scope Enforcement', () => {
    it('creates and recovers from a collaboration checkpoint', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Checkpoint Test',
        coordinatorAgentId: 'agent_coord',
      });

      const cpReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/checkpoints`,
        body: {
          description: 'Stable milestone after initial setup',
        },
      });
      setupSecurity(cpReq);

      const cpRes = await router.handle(cpReq);
      expect(cpRes.status).toBe(201);
      const cpData = cpRes.data as any;
      const cpId = cpData.checkpointId;

      const recReq = requestService.createRequest({
        method: 'POST',
        path: `/collaborations/${session.collaborationSessionId}/recover`,
        body: {
          checkpointId: cpId,
        },
      });
      setupSecurity(recReq);

      const recRes = await router.handle(recReq);
      expect(recRes.status).toBe(200);
      const recData = recRes.data as any;
      expect(recData.status).toBe('ACTIVE');
    });

    it('enforces workspace and project isolation', async () => {
      const session = await manager.createSession({
        workspaceId,
        projectId,
        title: 'Isolation Test',
        coordinatorAgentId: 'agent_coord',
      });

      // Attempt to access from a foreign workspace
      const crossWsReq = requestService.createRequest({
        method: 'GET',
        path: `/collaborations/${session.collaborationSessionId}`,
      });
      setupSecurity(crossWsReq, 'ws_foreign', projectId);

      await expect(router.handle(crossWsReq)).rejects.toThrow(ApiError);
    });
  });
});
