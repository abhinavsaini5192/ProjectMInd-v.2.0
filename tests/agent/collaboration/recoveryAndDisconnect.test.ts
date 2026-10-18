import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCollaborationStore } from '../../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../../src/agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../../src/agent/collaboration/services/HandoffCoordinator.js';
import { CollaborationManager } from '../../../src/agent/collaboration/services/CollaborationManager.js';
import { AgentRegistry } from '../../../src/agent/runtime/AgentRegistry.js';

describe('Collaboration Recovery & Agent Disconnect Tests (Phase 9.5 Section 31, 32, 46)', () => {
  let store: InMemoryCollaborationStore;
  let reservations: ResourceReservationService;
  let conflicts: ConflictDetector;
  let handoffs: HandoffCoordinator;
  let registry: AgentRegistry;
  let manager: CollaborationManager;
  let sessionId: string;

  beforeEach(async () => {
    store = new InMemoryCollaborationStore();
    reservations = new ResourceReservationService(store);
    conflicts = new ConflictDetector(store);
    handoffs = new HandoffCoordinator(store);
    registry = new AgentRegistry();
    manager = new CollaborationManager(store, reservations, conflicts, handoffs, undefined, registry);

    await registry.register({
      agentId: 'agent_coord',
      name: 'Coordinator',
      type: 'CODER' as any,
      version: '1.0.0',
    });
    await registry.register({
      agentId: 'agent_worker',
      name: 'Worker',
      type: 'CODER' as any,
      version: '1.0.0',
    });

    const session = await manager.createSession({
      workspaceId: 'ws_mind',
      projectId: 'proj_ecommerce',
      repositoryIds: ['repo_backend'],
      title: 'Checkout Flow',
      coordinatorAgentId: 'agent_coord',
    });
    sessionId = session.collaborationSessionId;

    await manager.joinParticipant(sessionId, {
      agentId: 'agent_worker',
      role: 'IMPLEMENTER',
    });

    await manager.assignTask(sessionId, 'task_order_calc', 'agent_worker');
    await reservations.reserve({
      collaborationSessionId: sessionId,
      ownerAgentId: 'agent_worker',
      resourceType: 'FILE',
      resourceId: 'src/checkout/OrderCalculator.ts',
      reason: 'Tax calculation logic',
      ttlMs: -500, // Expired
    });
  });

  it('1. agent disconnect marks participant disconnected, marks expired reservations stale, and preserves task state without false completion', async () => {
    // Update task status to IN_PROGRESS
    const currentOwnership = await manager.getTaskOwnership(sessionId, 'task_order_calc');
    await store.saveTaskOwnership(sessionId, {
      ...currentOwnership!,
      status: 'IN_PROGRESS',
    });

    // Simulate worker disconnect
    await manager.handleAgentDisconnect(sessionId, 'agent_worker');

    // 1. Participant is DISCONNECTED
    const session = await manager.getSession(sessionId);
    const worker = session.participants.find((p) => p.agentId === 'agent_worker');
    expect(worker?.status).toBe('DISCONNECTED');

    // 2. Task is BLOCKED, NOT falsely completed
    const taskOwnership = await manager.getTaskOwnership(sessionId, 'task_order_calc');
    expect(taskOwnership?.status).toBe('BLOCKED');
    expect(taskOwnership?.notes).toContain('disconnection');

    // 3. Expired reservation marked STALE
    const resvs = await store.listReservations({
      collaborationSessionId: sessionId,
      ownerAgentId: 'agent_worker',
    });
    expect(resvs.length).toBe(1);
    expect(resvs[0]!.isStale).toBe(true);
    expect(resvs[0]!.state).toBe('STALE');
  });

  it('2. creates collaboration checkpoint and restores state on recovery', async () => {
    // Create checkpoint
    const checkpoint = await manager.createCheckpoint(sessionId);
    expect(checkpoint.checkpointId).toBeDefined();
    expect(checkpoint.sessionStatus).toBe('ACTIVE');
    expect(checkpoint.activeTasks).toContain('task_order_calc');

    // Change session state
    await manager.updateSessionStatus(sessionId, 'PAUSED');
    let session = await manager.getSession(sessionId);
    expect(session.status).toBe('PAUSED');

    // Recover from checkpoint
    const recovered = await manager.recoverFromCheckpoint(sessionId, checkpoint.checkpointId);
    expect(recovered.status).toBe('ACTIVE');

    // Verify task ownership intact
    const task = await manager.getTaskOwnership(sessionId, 'task_order_calc');
    expect(task?.ownerAgentId).toBe('agent_worker');
  });
});
