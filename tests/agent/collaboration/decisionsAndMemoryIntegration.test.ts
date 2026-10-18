import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCollaborationStore } from '../../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../../src/agent/collaboration/services/ResourceReservationService.js';
import { ConflictDetector } from '../../../src/agent/collaboration/services/ConflictDetector.js';
import { HandoffCoordinator } from '../../../src/agent/collaboration/services/HandoffCoordinator.js';
import { CollaborationManager } from '../../../src/agent/collaboration/services/CollaborationManager.js';
import { InMemoryProjectMemoryStore } from '../../../src/memory/project/services/InMemoryProjectMemoryStore.js';
import { ProjectMemoryManager } from '../../../src/memory/project/services/ProjectMemoryManager.js';

describe('Collaboration Decisions & Project Memory Integration Tests (Phase 9.5 Section 24, 25, 47)', () => {
  let collabStore: InMemoryCollaborationStore;
  let memoryStore: InMemoryProjectMemoryStore;
  let memoryManager: ProjectMemoryManager;
  let manager: CollaborationManager;
  let sessionId: string;

  beforeEach(async () => {
    collabStore = new InMemoryCollaborationStore();
    memoryStore = new InMemoryProjectMemoryStore();
    memoryManager = new ProjectMemoryManager(memoryStore);

    const reservations = new ResourceReservationService(collabStore);
    const conflicts = new ConflictDetector(collabStore);
    const handoffs = new HandoffCoordinator(collabStore);

    manager = new CollaborationManager(
      collabStore,
      reservations,
      conflicts,
      handoffs,
      undefined,
      undefined,
      undefined,
      memoryManager
    );

    const session = await manager.createSession({
      workspaceId: 'ws_mind',
      projectId: 'proj_ecommerce',
      repositoryIds: ['repo_backend'],
      title: 'Payment Gateway Migration',
      coordinatorAgentId: 'agent_coord',
    });
    sessionId = session.collaborationSessionId;
  });

  it('1. records structured collaboration decision with rationale and alternatives', async () => {
    const decision = await manager.recordDecision({
      collaborationSessionId: sessionId,
      projectId: 'proj_ecommerce',
      taskId: 'task_stripe_migration',
      decision: 'Standardize on Stripe payment intent webhooks',
      rationaleSummary: 'Stripe payment intents support 3D-Secure 2.0 and async authorization flows natively.',
      alternatives: ['Braintree drop-in UI', 'PayPal Express Checkout'],
      evidence: ['ADR-102', 'Stripe API v2024-06 docs'],
      participants: ['agent_backend', 'agent_security'],
      authority: 'AGENT_PROPOSED',
    });

    expect(decision.decisionId).toBeDefined();
    expect(decision.authority).toBe('AGENT_PROPOSED');
    expect(decision.status).toBe('ACCEPTED');

    const list = await collabStore.listDecisions(sessionId);
    expect(list.length).toBe(1);
    expect(list[0]!.decision).toBe('Standardize on Stripe payment intent webhooks');
  });

  it('2. promotes decision to ProjectMemory through governance pipeline respecting provenance rules', async () => {
    const decision = await manager.recordDecision({
      collaborationSessionId: sessionId,
      projectId: 'proj_ecommerce',
      taskId: 'task_stripe_migration',
      decision: 'Authentication API will remain backward compatible',
      rationaleSummary: 'Legacy mobile clients require v1 session tokens until sunset in Q4.',
      alternatives: ['Immediate deprecation'],
      evidence: ['Client metrics dashboard'],
      participants: ['agent_backend', 'agent_frontend'],
      authority: 'AGENT_PROPOSED', // Agent proposed
    });

    // Promote decision to Project Memory
    const memory = await manager.promoteDecisionToMemory(decision.decisionId, 'agent_coord');
    expect(memory).toBeDefined();
    expect(memory.memoryId).toBeDefined();
    expect(memory.title).toBe('Authentication API will remain backward compatible');
    // Provenance rule: agent proposed decision promoted without explicit developer override remains NON_AUTHORITATIVE
    expect(memory.authority).toBe('NON_AUTHORITATIVE');

    // Collaboration decision status updated
    const updatedDecision = await collabStore.getDecision(decision.decisionId);
    expect(updatedDecision?.status).toBe('PROMOTED_TO_MEMORY');
    expect(updatedDecision?.promotedMemoryId).toBe(memory.memoryId);

    // Verified in ProjectMemory store
    const storedMemories = await memoryStore.find({
      workspaceId: 'ws_mind',
      projectId: 'proj_ecommerce',
    });
    expect(storedMemories.length).toBe(1);
    expect(storedMemories[0]!.title).toContain('Authentication API');
  });

  it('3. promotes policy decision to AUTHORITATIVE project memory when tagged as PROJECT_POLICY', async () => {
    const decision = await manager.recordDecision({
      collaborationSessionId: sessionId,
      projectId: 'proj_ecommerce',
      taskId: 'task_security_policy',
      decision: 'Mandatory HMAC-SHA256 signature on all webhook endpoints',
      rationaleSummary: 'Security compliance requires payload signature verification on incoming webhooks.',
      alternatives: [],
      evidence: ['SEC-POLICY-01'],
      participants: ['agent_security'],
      authority: 'PROJECT_POLICY', // Explicit team/project policy
    });

    const memory = await manager.promoteDecisionToMemory(decision.decisionId, 'team_lead');
    expect(memory.authority).toBe('AUTHORITATIVE');
  });
});
