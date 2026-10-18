import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCollaborationStore } from '../../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../../src/agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../../src/agent/collaboration/services/HandoffCoordinator.js';
import { CollaborationManager } from '../../../src/agent/collaboration/services/CollaborationManager.js';
import { AgentRegistry } from '../../../src/agent/runtime/AgentRegistry.js';
import {
  CollaborationError,
  CollaborationConflictError,
  CollaborationNotFoundError,
} from '../../../src/agent/collaboration/errors/CollaborationError.js';

describe('CollaborationSession & Participant Tests (Phase 9.5 Section 5, 6, 8, 9, 10)', () => {
  let store: InMemoryCollaborationStore;
  let reservations: ResourceReservationService;
  let conflicts: ConflictDetector;
  let handoffs: HandoffCoordinator;
  let registry: AgentRegistry;
  let manager: CollaborationManager;

  beforeEach(async () => {
    store = new InMemoryCollaborationStore();
    reservations = new ResourceReservationService(store);
    conflicts = new ConflictDetector(store);
    handoffs = new HandoffCoordinator(store);
    registry = new AgentRegistry();
    manager = new CollaborationManager(store, reservations, conflicts, handoffs, undefined, registry);

    // Register active agents in AgentRegistry
    await registry.register({
      agentId: 'agent_coord_01',
      name: 'Coordinator Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });

    await registry.register({
      agentId: 'agent_backend_02',
      name: 'Backend Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });

    await registry.register({
      agentId: 'agent_frontend_03',
      name: 'Frontend Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });
  });

  describe('Session Lifecycle & Scoping', () => {
    it('creates collaboration session and automatically joins coordinator', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Checkout Flow Redesign',
        coordinatorAgentId: 'agent_coord_01',
        description: 'Redesigning cart checkout and payment APIs',
      });

      expect(session.collaborationSessionId).toBeDefined();
      expect(session.status).toBe('ACTIVE');
      expect(session.participants.length).toBe(1);
      expect(session.participants[0]!.agentId).toBe('agent_coord_01');
      expect(session.participants[0]!.role).toBe('COORDINATOR');
      expect(session.participants[0]!.status).toBe('ONLINE');

      const retrieved = await manager.getSession(session.collaborationSessionId);
      expect(retrieved.title).toBe('Checkout Flow Redesign');
    });

    it('rejects session creation with missing workspace or project scope', async () => {
      await expect(
        manager.createSession({
          workspaceId: '',
          projectId: 'proj_ecommerce',
          repositoryIds: ['repo_backend'],
          title: 'Invalid',
          coordinatorAgentId: 'agent_coord_01',
        })
      ).rejects.toThrow(CollaborationError);
    });

    it('rejects session creation with unregistered or inactive coordinator', async () => {
      await expect(
        manager.createSession({
          workspaceId: 'ws_mind',
          projectId: 'proj_ecommerce',
          repositoryIds: ['repo_backend'],
          title: 'Invalid Coordinator',
          coordinatorAgentId: 'nonexistent_agent_999',
        })
      ).rejects.toThrow('not registered or active');
    });

    it('updates session status through lifecycle transitions', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Session Transitions',
        coordinatorAgentId: 'agent_coord_01',
      });

      const paused = await manager.updateSessionStatus(session.collaborationSessionId, 'PAUSED');
      expect(paused.status).toBe('PAUSED');
      expect(paused.version).toBe(2);

      const completed = await manager.updateSessionStatus(session.collaborationSessionId, 'COMPLETED');
      expect(completed.status).toBe('COMPLETED');
      expect(completed.version).toBe(3);
    });
  });

  describe('Participant Management', () => {
    it('joins active agents and rejects duplicate participation', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Participant Test',
        coordinatorAgentId: 'agent_coord_01',
      });

      const participant = await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend_02',
        role: 'IMPLEMENTER',
        capabilities: ['typescript', 'nestjs'],
      });

      expect(participant.agentId).toBe('agent_backend_02');
      expect(participant.role).toBe('IMPLEMENTER');
      expect(participant.status).toBe('ONLINE');

      // Duplicate join throws conflict
      await expect(
        manager.joinParticipant(session.collaborationSessionId, {
          agentId: 'agent_backend_02',
          role: 'IMPLEMENTER',
        })
      ).rejects.toThrow(CollaborationConflictError);
    });

    it('allows participant to leave session cleanly', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Participant Leave Test',
        coordinatorAgentId: 'agent_coord_01',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend_02',
        role: 'IMPLEMENTER',
      });

      const left = await manager.leaveParticipant(
        session.collaborationSessionId,
        'agent_backend_02',
        'Finished backend phase'
      );
      expect(left).toBe(true);

      const updatedSession = await manager.getSession(session.collaborationSessionId);
      const backend = updatedSession.participants.find((p) => p.agentId === 'agent_backend_02');
      expect(backend?.status).toBe('REMOVED');
    });

    it('updates participant status', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Presence Test',
        coordinatorAgentId: 'agent_coord_01',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend_02',
        role: 'IMPLEMENTER',
      });

      const updated = await manager.updateParticipantStatus(
        session.collaborationSessionId,
        'agent_backend_02',
        'BUSY'
      );
      expect(updated.status).toBe('BUSY');
    });
  });

  describe('Task Assignment & Ownership', () => {
    it('assigns task to participant and tracks ownership', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Task Assignment Test',
        coordinatorAgentId: 'agent_coord_01',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend_02',
        role: 'IMPLEMENTER',
      });

      const ownership = await manager.assignTask(
        session.collaborationSessionId,
        'task_api_checkout',
        'agent_backend_02'
      );

      expect(ownership.taskId).toBe('task_api_checkout');
      expect(ownership.ownerAgentId).toBe('agent_backend_02');
      expect(ownership.status).toBe('ASSIGNED');

      const retrieved = await manager.getTaskOwnership(
        session.collaborationSessionId,
        'task_api_checkout'
      );
      expect(retrieved?.ownerAgentId).toBe('agent_backend_02');
    });

    it('prevents assigning task to non-participant agent', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Invalid Assignment Test',
        coordinatorAgentId: 'agent_coord_01',
      });

      await expect(
        manager.assignTask(
          session.collaborationSessionId,
          'task_api_checkout',
          'agent_frontend_03' // Not joined yet
        )
      ).rejects.toThrow('not an active participant');
    });

    it('detects conflict when second agent attempts to claim already assigned active task', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Task Conflict Test',
        coordinatorAgentId: 'agent_coord_01',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend_02',
        role: 'IMPLEMENTER',
      });
      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_frontend_03',
        role: 'IMPLEMENTER',
      });

      await manager.assignTask(
        session.collaborationSessionId,
        'task_api_checkout',
        'agent_backend_02'
      );

      // Attempt to assign same task to frontend agent throws conflict
      await expect(
        manager.assignTask(
          session.collaborationSessionId,
          'task_api_checkout',
          'agent_frontend_03'
        )
      ).rejects.toThrow(CollaborationConflictError);
    });

    it('unassigns task cleanly', async () => {
      const session = await manager.createSession({
        workspaceId: 'ws_mind',
        projectId: 'proj_ecommerce',
        repositoryIds: ['repo_backend'],
        title: 'Task Unassign Test',
        coordinatorAgentId: 'agent_coord_01',
      });

      await manager.joinParticipant(session.collaborationSessionId, {
        agentId: 'agent_backend_02',
        role: 'IMPLEMENTER',
      });

      await manager.assignTask(
        session.collaborationSessionId,
        'task_api_checkout',
        'agent_backend_02'
      );

      const unassigned = await manager.unassignTask(
        session.collaborationSessionId,
        'task_api_checkout'
      );
      expect(unassigned).toBe(true);

      const ownership = await manager.getTaskOwnership(
        session.collaborationSessionId,
        'task_api_checkout'
      );
      expect(ownership).toBeUndefined();
    });
  });
});
