import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCollaborationStore } from '../../../src/agent/collaboration/services/InMemoryCollaborationStore.js';
import { ResourceReservationService } from '../../../src/agent/collaboration/services/ResourceReservationService.js';
import {
  CollaborationConflictError,
  CollaborationError,
} from '../../../src/agent/collaboration/errors/CollaborationError.js';

describe('ResourceReservation Tests (Phase 9.5 Section 11, 12, 13, 33)', () => {
  let store: InMemoryCollaborationStore;
  let reservations: ResourceReservationService;

  beforeEach(() => {
    store = new InMemoryCollaborationStore();
    reservations = new ResourceReservationService(store);
  });

  it('1. reserves fine-grained resource successfully', async () => {
    const resv = await reservations.reserve({
      collaborationSessionId: 'collab_checkout_01',
      ownerAgentId: 'agent_backend',
      resourceType: 'FILE',
      resourceId: 'src/checkout/CartService.ts',
      reason: 'Refactoring checkout cart validation logic',
      ttlMs: 60000,
    });

    expect(resv.reservationId).toBeDefined();
    expect(resv.ownerAgentId).toBe('agent_backend');
    expect(resv.state).toBe('RESERVED');
    expect(resv.isStale).toBe(false);
    expect(resv.expiresAt).toBeGreaterThan(Date.now());
  });

  it('2. re-affirming or renewing reservation by same owner succeeds and extends TTL', async () => {
    const initial = await reservations.reserve({
      collaborationSessionId: 'collab_checkout_01',
      ownerAgentId: 'agent_backend',
      resourceType: 'API',
      resourceId: '/api/v1/checkout/pay',
      reason: 'Updating payload schema',
      ttlMs: 10000,
    });

    // Re-reserve by same owner
    const renewed = await reservations.reserve({
      collaborationSessionId: 'collab_checkout_01',
      ownerAgentId: 'agent_backend',
      resourceType: 'API',
      resourceId: '/api/v1/checkout/pay',
      reason: 'Still updating payload schema',
      ttlMs: 50000,
    });

    expect(renewed.reservationId).toBe(initial.reservationId);
    expect(renewed.expiresAt).toBeGreaterThan(initial.expiresAt);
  });

  it('3. rejects concurrent reservation on same resource by another agent with conflict', async () => {
    await reservations.reserve({
      collaborationSessionId: 'collab_checkout_01',
      ownerAgentId: 'agent_backend',
      resourceType: 'FILE',
      resourceId: 'src/checkout/OrderProcessor.ts',
      reason: 'Implementing order processing',
      ttlMs: 60000,
    });

    // Frontend agent attempts to reserve the same file
    await expect(
      reservations.reserve({
        collaborationSessionId: 'collab_checkout_01',
        ownerAgentId: 'agent_frontend',
        resourceType: 'FILE',
        resourceId: 'src/checkout/OrderProcessor.ts',
        reason: 'Attempting conflicting edit',
      })
    ).rejects.toThrow(CollaborationConflictError);
  });

  it('4. releases reservation cleanly by owner and prevents unauthorized release', async () => {
    const resv = await reservations.reserve({
      collaborationSessionId: 'collab_checkout_01',
      ownerAgentId: 'agent_backend',
      resourceType: 'FEATURE',
      resourceId: 'feat_checkout_service',
      reason: 'Feature refactor',
    });

    // Unauthorized release by another agent fails
    await expect(
      reservations.release(resv.reservationId, 'agent_frontend')
    ).rejects.toThrow(CollaborationError);

    // Authorized release by owner succeeds
    const released = await reservations.release(resv.reservationId, 'agent_backend');
    expect(released).toBe(true);

    const inspected = await reservations.inspect('feat_checkout_service', 'collab_checkout_01');
    expect(inspected).toBeNull();
  });

  it('5. detects stale reservations when TTL expires and purges them according to policy', async () => {
    // Reserve with negative TTL (already expired)
    await reservations.reserve({
      collaborationSessionId: 'collab_checkout_01',
      ownerAgentId: 'agent_backend',
      resourceType: 'CONFIGURATION',
      resourceId: 'config/payments.json',
      reason: 'Temporary secret config edit',
      ttlMs: -1000, // Expired immediately
    });

    const stale = await reservations.listStaleReservations('collab_checkout_01');
    expect(stale.length).toBe(1);
    expect(stale[0]!.resourceId).toBe('config/payments.json');

    // Purge with markStaleOnly policy
    const purgedIds = await reservations.purgeStale({ markStaleOnly: true });
    expect(purgedIds.length).toBe(1);

    const stored = await store.getReservation(stale[0]!.reservationId);
    expect(stored?.isStale).toBe(true);
    expect(stored?.state).toBe('STALE');
  });
});
