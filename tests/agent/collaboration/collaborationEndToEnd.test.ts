import { describe, it, expect } from 'vitest';
import { InMemoryCollaborationStore } from '../../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../../src/agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../../src/agent/collaboration/services/HandoffCoordinator.js';
import { CollaborationContextService } from '../../../src/agent/collaboration/services/CollaborationContextService.js';
import { CollaborationManager } from '../../../src/agent/collaboration/services/CollaborationManager.js';
import { AgentRegistry } from '../../../src/agent/runtime/AgentRegistry.js';
import { InMemoryProjectMemoryStore } from '../../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { ProjectMemoryManager } from '../../../src/memory/project/services/ProjectMemoryManager.js';
import { CollaborationConflictError } from '../../../src/agent/collaboration/errors/CollaborationError.js';

describe('Phase 9.5 Complete End-to-End Multi-Agent Scenario (Section 45)', () => {
  it('executes full 18-step collaborative workflow across Backend, Frontend, and Testing agents', async () => {
    // 0. Setup collaboration environment
    const store = new InMemoryCollaborationStore();
    const reservations = new ResourceReservationService(store);
    const conflicts = new ConflictDetector(store);
    const handoffs = new HandoffCoordinator(store);
    const contextService = new CollaborationContextService(store);
    const registry = new AgentRegistry();
    const memoryStore = new InMemoryProjectMemoryStore();
    const memoryManager = new ProjectMemoryManager(memoryStore);

    const manager = new CollaborationManager(
      store,
      reservations,
      conflicts,
      handoffs,
      contextService,
      registry,
      undefined,
      memoryManager
    );

    // Register 3 agents
    await registry.register({
      agentId: 'agent_backend_A',
      name: 'Backend Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });
    await registry.register({
      agentId: 'agent_frontend_B',
      name: 'Frontend Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });
    await registry.register({
      agentId: 'agent_tester_C',
      name: 'Testing Agent',
      type: 'CODER' as any,
      version: '1.0.0',
    });

    // 1. Create collaboration session for E-commerce platform
    const session = await manager.createSession({
      workspaceId: 'ws_ecommerce',
      projectId: 'proj_shop',
      repositoryIds: ['repo_platform'],
      title: 'Checkout Flow Overhaul',
      coordinatorAgentId: 'agent_backend_A',
    });
    const sessionId = session.collaborationSessionId;
    expect(session.status).toBe('ACTIVE');

    // 2. Add agents B and C
    await manager.joinParticipant(sessionId, {
      agentId: 'agent_frontend_B',
      role: 'IMPLEMENTER',
      capabilities: ['react', 'nextjs'],
    });
    await manager.joinParticipant(sessionId, {
      agentId: 'agent_tester_C',
      role: 'TESTER',
      capabilities: ['vitest', 'playwright'],
    });

    const activeSession = await manager.getSession(sessionId);
    expect(activeSession.participants.length).toBe(3);

    // 3. Create and assign backend task
    const taskOwnership = await manager.assignTask(
      sessionId,
      'task_checkout_backend',
      'agent_backend_A'
    );
    expect(taskOwnership.ownerAgentId).toBe('agent_backend_A');

    // 4. Backend agent reserves API resource
    const resv = await reservations.reserve({
      collaborationSessionId: sessionId,
      ownerAgentId: 'agent_backend_A',
      resourceType: 'API',
      resourceId: 'src/api/checkout.ts',
      reason: 'Redesigning payment intent POST handler',
    });
    expect(resv.ownerAgentId).toBe('agent_backend_A');

    // Conflict check: Frontend agent B attempting to reserve same resource raises conflict
    await expect(
      reservations.reserve({
        collaborationSessionId: sessionId,
        ownerAgentId: 'agent_frontend_B',
        resourceType: 'API',
        resourceId: 'src/api/checkout.ts',
        reason: 'Attempting simultaneous modification',
      })
    ).rejects.toThrow(CollaborationConflictError);

    // 5. Backend agent implements change externally
    // 6. Backend agent reports execution (Observation provenance: AGENT_REPORTED)
    const reportMsg = await manager.sendMessage({
      collaborationSessionId: sessionId,
      senderAgentId: 'agent_backend_A',
      recipientAgentIds: ['agent_frontend_B', 'agent_tester_C'],
      taskId: 'task_checkout_backend',
      projectId: 'proj_shop',
      workspaceId: 'ws_ecommerce',
      type: 'STATUS',
      payload: {
        title: 'API Implementation Complete',
        content: 'POST /api/checkout endpoints created and ready for client consumption.',
        referencedResources: ['src/api/checkout.ts'],
      },
      correlationId: 'corr_exec_01',
    });
    expect(reportMsg.provenance).toBe('AGENT_REPORTED');

    // 7. Verification occurs (external verification passes)
    // 8. Knowledge Update Loop updates ProjectMind state

    // 9. Backend agent creates handoff to Frontend agent B
    const handoff = await handoffs.proposeHandoff({
      collaborationSessionId: sessionId,
      sourceAgentId: 'agent_backend_A',
      targetAgentId: 'agent_frontend_B',
      taskId: 'task_checkout_backend',
      projectId: 'proj_shop',
      summary: 'Checkout backend complete; handoff to frontend for UI form integration.',
      completedWork: ['Endpoint created', 'Unit tests passing'],
      remainingWork: ['Wire up React checkout form', 'Display error banners'],
      changedResources: ['src/api/checkout.ts'],
      verificationStatus: 'SYSTEM_VERIFIED',
    });
    expect(handoff.status).toBe('PROPOSED');

    // 10. Frontend agent receives scoped context
    const frontendContext = await contextService.buildAgentContext(sessionId, 'agent_frontend_B');
    expect(frontendContext.role).toBe('IMPLEMENTER');
    expect(frontendContext.sharedContext.title).toBe('Checkout Flow Overhaul');

    // 11. Frontend agent accepts handoff and works on integration
    const acceptedHandoff = await handoffs.acceptHandoff(handoff.handoffId, 'agent_frontend_B');
    expect(acceptedHandoff.status).toBe('ACCEPTED');

    // Task ownership automatically transferred to Agent B
    const updatedOwnership = await manager.getTaskOwnership(sessionId, 'task_checkout_backend');
    expect(updatedOwnership?.ownerAgentId).toBe('agent_frontend_B');

    // Release backend reservation and reserve frontend view
    await reservations.release(resv.reservationId, 'agent_backend_A');
    await reservations.reserve({
      collaborationSessionId: sessionId,
      ownerAgentId: 'agent_frontend_B',
      resourceType: 'FILE',
      resourceId: 'src/views/CheckoutModal.tsx',
      reason: 'Implementing modal UI',
    });

    // 12. Frontend hands off to Testing agent C
    const testHandoff = await handoffs.proposeHandoff({
      collaborationSessionId: sessionId,
      sourceAgentId: 'agent_frontend_B',
      targetAgentId: 'agent_tester_C',
      taskId: 'task_checkout_backend',
      projectId: 'proj_shop',
      summary: 'Frontend integration complete; handoff to testing agent.',
      completedWork: ['React form built', 'API wired'],
      remainingWork: ['End-to-end user journey tests'],
      changedResources: ['src/views/CheckoutModal.tsx'],
      verificationStatus: 'SYSTEM_VERIFIED',
    });

    await handoffs.acceptHandoff(testHandoff.handoffId, 'agent_tester_C');

    // 13. Testing agent receives relevant context and verifies
    const testerContext = await contextService.buildAgentContext(sessionId, 'agent_tester_C');
    expect(testerContext.role).toBe('TESTER');

    // 14. Conflicts verified clear
    const activeConflicts = await conflicts.detectConflicts(sessionId);
    expect(activeConflicts.length).toBe(0);

    // 15. Record meaningful architecture decision
    const decision = await manager.recordDecision({
      collaborationSessionId: sessionId,
      projectId: 'proj_shop',
      taskId: 'task_checkout_backend',
      decision: 'Checkout session tokens use 15-minute expiration with renewal on payment challenge',
      rationaleSummary: 'Mitigates token leakage while maintaining smooth UX during checkout 3DS challenges.',
      alternatives: ['Permanent session tokens'],
      evidence: ['PCI compliance review', 'E2E test pass'],
      participants: ['agent_backend_A', 'agent_frontend_B', 'agent_tester_C'],
      authority: 'PROJECT_POLICY',
    });

    // 16. Promote decision to Project Memory through governance
    const memory = await manager.promoteDecisionToMemory(decision.decisionId, 'team_lead');
    expect(memory.authority).toBe('AUTHORITATIVE');
    expect(memory.title).toContain('Checkout session tokens');

    // 17. Collaboration reaches completion
    const finalSession = await manager.updateSessionStatus(sessionId, 'COMPLETED');
    expect(finalSession.status).toBe('COMPLETED');
    expect(finalSession.version).toBeGreaterThan(1);
  });
});
