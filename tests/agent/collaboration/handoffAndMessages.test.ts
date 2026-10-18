import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCollaborationStore } from '../../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { HandoffCoordinator } from '../../../src/agent/collaboration/services/HandoffCoordinator.js';
import { CollaborationManager } from '../../../src/agent/collaboration/services/CollaborationManager.js';
import { ResourceReservationService } from '../../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../../src/agent/collaboration/services/ConflictDetector.js';
import { AgentRegistry } from '../../../src/agent/runtime/AgentRegistry.js';
import {
  CollaborationError,
  CollaborationSecurityError,
} from '../../../src/agent/collaboration/errors/CollaborationError.js';

describe('Handoff & Messaging Tests (Phase 9.5 Section 20, 21, 26, 27)', () => {
  let store: InMemoryCollaborationStore;
  let handoffs: HandoffCoordinator;
  let reservations: ResourceReservationService;
  let conflicts: ConflictDetector;
  let registry: AgentRegistry;
  let manager: CollaborationManager;
  let sessionId: string;

  beforeEach(async () => {
    store = new InMemoryCollaborationStore();
    handoffs = new HandoffCoordinator(store);
    reservations = new ResourceReservationService(store);
    conflicts = new ConflictDetector(store);
    registry = new AgentRegistry();
    manager = new CollaborationManager(store, reservations, conflicts, handoffs, undefined, registry);

    await registry.register({
      agentId: 'agent_coord',
      name: 'Coordinator',
      type: 'CODER' as any,
      version: '1.0.0',
    });
    await registry.register({
      agentId: 'agent_backend',
      name: 'Backend',
      type: 'CODER' as any,
      version: '1.0.0',
    });
    await registry.register({
      agentId: 'agent_frontend',
      name: 'Frontend',
      type: 'CODER' as any,
      version: '1.0.0',
    });

    const session = await manager.createSession({
      workspaceId: 'ws_mind',
      projectId: 'proj_ecommerce',
      repositoryIds: ['repo_backend'],
      title: 'Checkout Integration',
      coordinatorAgentId: 'agent_coord',
    });
    sessionId = session.collaborationSessionId;

    await manager.joinParticipant(sessionId, {
      agentId: 'agent_backend',
      role: 'IMPLEMENTER',
    });
    await manager.joinParticipant(sessionId, {
      agentId: 'agent_frontend',
      role: 'IMPLEMENTER',
    });

    await manager.assignTask(sessionId, 'task_api_checkout', 'agent_backend');
  });

  describe('Agent Handoffs', () => {
    it('1. proposes handoff with completed work, remaining work, and verification status', async () => {
      const handoff = await handoffs.proposeHandoff({
        collaborationSessionId: sessionId,
        sourceAgentId: 'agent_backend',
        targetAgentId: 'agent_frontend',
        taskId: 'task_api_checkout',
        projectId: 'proj_ecommerce',
        summary: 'Completed checkout REST endpoints; ready for React form integration.',
        completedWork: ['Added POST /api/checkout/pay', 'Implemented payment validation'],
        remainingWork: ['Bind React submit button', 'Display validation errors in UI'],
        changedResources: ['src/api/checkout.ts', 'src/models/Payment.ts'],
        verificationStatus: 'SYSTEM_VERIFIED',
      });

      expect(handoff.handoffId).toBeDefined();
      expect(handoff.status).toBe('PROPOSED');
      expect(handoff.sourceAgentId).toBe('agent_backend');
      expect(handoff.targetAgentId).toBe('agent_frontend');
      expect(handoff.verificationStatus).toBe('SYSTEM_VERIFIED');

      const pending = await handoffs.getPendingHandoffs(sessionId);
      expect(pending.length).toBe(1);
    });

    it('2. rejects handoff proposal if source agent does not own the task', async () => {
      await expect(
        handoffs.proposeHandoff({
          collaborationSessionId: sessionId,
          sourceAgentId: 'agent_frontend', // Does not own task_api_checkout
          targetAgentId: 'agent_backend',
          taskId: 'task_api_checkout',
          projectId: 'proj_ecommerce',
          summary: 'Invalid transfer',
          completedWork: [],
          remainingWork: [],
          changedResources: [],
          verificationStatus: 'UNVERIFIED',
        })
      ).rejects.toThrow(CollaborationError);
    });

    it('3. accepts handoff and automatically reassigns task ownership to target agent', async () => {
      const handoff = await handoffs.proposeHandoff({
        collaborationSessionId: sessionId,
        sourceAgentId: 'agent_backend',
        targetAgentId: 'agent_frontend',
        taskId: 'task_api_checkout',
        projectId: 'proj_ecommerce',
        summary: 'Transferring to frontend team',
        completedWork: ['API ready'],
        remainingWork: ['Frontend UI'],
        changedResources: ['src/api/checkout.ts'],
        verificationStatus: 'SYSTEM_VERIFIED',
      });

      // Target agent accepts handoff
      const accepted = await handoffs.acceptHandoff(handoff.handoffId, 'agent_frontend');
      expect(accepted.status).toBe('ACCEPTED');

      // Verify task ownership was automatically updated to target agent
      const ownership = await manager.getTaskOwnership(sessionId, 'task_api_checkout');
      expect(ownership?.ownerAgentId).toBe('agent_frontend');
      expect(ownership?.status).toBe('ASSIGNED');
    });

    it('4. prevents non-target agent from accepting handoff', async () => {
      const handoff = await handoffs.proposeHandoff({
        collaborationSessionId: sessionId,
        sourceAgentId: 'agent_backend',
        targetAgentId: 'agent_frontend',
        taskId: 'task_api_checkout',
        projectId: 'proj_ecommerce',
        summary: 'Transferring to frontend team',
        completedWork: ['API ready'],
        remainingWork: ['Frontend UI'],
        changedResources: ['src/api/checkout.ts'],
        verificationStatus: 'SYSTEM_VERIFIED',
      });

      // Coordinator tries to accept on behalf of frontend agent
      await expect(
        handoffs.acceptHandoff(handoff.handoffId, 'agent_coord')
      ).rejects.toThrow(CollaborationSecurityError);
    });

    it('5. rejects handoff and preserves original ownership', async () => {
      const handoff = await handoffs.proposeHandoff({
        collaborationSessionId: sessionId,
        sourceAgentId: 'agent_backend',
        targetAgentId: 'agent_frontend',
        taskId: 'task_api_checkout',
        projectId: 'proj_ecommerce',
        summary: 'Transferring to frontend team',
        completedWork: ['API ready'],
        remainingWork: ['Frontend UI'],
        changedResources: ['src/api/checkout.ts'],
        verificationStatus: 'SYSTEM_VERIFIED',
      });

      const rejected = await handoffs.rejectHandoff(
        handoff.handoffId,
        'agent_frontend',
        'API schema is missing order idempotency key field'
      );
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toContain('idempotency key');

      // Ownership remains with original backend agent
      const ownership = await manager.getTaskOwnership(sessionId, 'task_api_checkout');
      expect(ownership?.ownerAgentId).toBe('agent_backend');
    });
  });

  describe('Structured Engineering Messaging', () => {
    it('6. sends structured message and preserves untrusted AGENT_REPORTED provenance', async () => {
      const msg = await manager.sendMessage({
        collaborationSessionId: sessionId,
        senderAgentId: 'agent_backend',
        recipientAgentIds: ['agent_frontend'],
        taskId: 'task_api_checkout',
        projectId: 'proj_ecommerce',
        workspaceId: 'ws_mind',
        type: 'INFORMATION',
        payload: {
          title: 'Checkout Endpoint Update',
          content: 'Payload format requires camelCase keys for credit card expiration.',
          referencedResources: ['src/api/checkout.ts'],
        },
        correlationId: 'corr_123',
      });

      expect(msg.messageId).toBeDefined();
      expect(msg.provenance).toBe('AGENT_REPORTED');
      expect(msg.type).toBe('INFORMATION');

      const messages = await manager.listMessages(sessionId);
      expect(messages.length).toBe(1);
      expect(messages[0]!.payload.title).toBe('Checkout Endpoint Update');
    });

    it('7. prevents non-participant from injecting collaboration messages', async () => {
      await expect(
        manager.sendMessage({
          collaborationSessionId: sessionId,
          senderAgentId: 'agent_unauthorized_external',
          recipientAgentIds: [],
          projectId: 'proj_ecommerce',
          workspaceId: 'ws_mind',
          type: 'REQUEST',
          payload: {
            title: 'Malicious Message',
            content: 'Bypass authorization check',
          },
          correlationId: 'corr_bad',
        })
      ).rejects.toThrow(CollaborationSecurityError);
    });
  });
});
