import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CoordinationService } from '../../src/concurrency/coordination/CoordinationService.js';
import { LeaderElector } from '../../src/concurrency/coordination/LeaderElector.js';

describe('Concurrency - Coordination & Leases', () => {
  let coordination: CoordinationService;

  beforeEach(() => {
    coordination = new CoordinationService({ defaultTtlMs: 200 });
  });

  it('acquires, renews, and releases a lease successfully', async () => {
    const lease = await coordination.acquireLease('migration-run', 'instance-1');
    expect(lease).toBeDefined();
    expect(lease?.holderId).toBe('instance-1');
    expect(lease?.renewCount).toBe(0);

    const renewed = await coordination.renewLease(lease!.leaseId, 'instance-1', 500);
    expect(renewed).toBe(true);

    const inspectLease = await coordination.getLease('migration-run');
    expect(inspectLease?.renewCount).toBe(1);

    const released = await coordination.releaseLease(lease!.leaseId, 'instance-1');
    expect(released).toBe(true);
    expect(await coordination.getLease('migration-run')).toBeNull();
  });

  it('rejects lease acquisition when actively held by another instance', async () => {
    const first = await coordination.acquireLease('singleton-job', 'instance-a');
    expect(first).toBeDefined();

    const second = await coordination.acquireLease('singleton-job', 'instance-b');
    expect(second).toBeNull();
  });

  it('supports atomic Compare-and-Set (CAS) version increments', async () => {
    expect(await coordination.getVersion('resource-x')).toBe(0);

    // Initial CAS from 0 to 1
    const cas1 = await coordination.compareAndSet('resource-x', 0, 1);
    expect(cas1).toBe(true);
    expect(await coordination.getVersion('resource-x')).toBe(1);

    // Stale CAS expecting 0 should fail
    const staleCas = await coordination.compareAndSet('resource-x', 0, 2);
    expect(staleCas).toBe(false);
    expect(await coordination.getVersion('resource-x')).toBe(1);

    // Valid CAS expecting 1 to 2 succeeds
    const cas2 = await coordination.compareAndSet('resource-x', 1, 2);
    expect(cas2).toBe(true);
    expect(await coordination.getVersion('resource-x')).toBe(2);
  });

  describe('LeaderElector', () => {
    let elector1: LeaderElector;
    let elector2: LeaderElector;

    beforeEach(() => {
      elector1 = new LeaderElector('maintenance-sweeper', 'inst-1', coordination, {
        ttlMs: 150,
        heartbeatIntervalMs: 50,
      });
      elector2 = new LeaderElector('maintenance-sweeper', 'inst-2', coordination, {
        ttlMs: 150,
        heartbeatIntervalMs: 50,
      });
    });

    afterEach(async () => {
      await elector1.stop();
      await elector2.stop();
    });

    it('elects exactly one leader among multiple candidates', async () => {
      const won1 = await elector1.tryAcquireLeadership();
      const won2 = await elector2.tryAcquireLeadership();

      expect(won1).toBe(true);
      expect(won2).toBe(false);

      expect(elector1.isLeader()).toBe(true);
      expect(elector2.isLeader()).toBe(false);
      expect(await elector1.getLeader()).toBe('inst-1');
    });

    it('fails over to another candidate when current leader steps down', async () => {
      await elector1.tryAcquireLeadership();
      expect(elector1.isLeader()).toBe(true);

      // Leader steps down voluntarily
      await elector1.stepDown();
      expect(elector1.isLeader()).toBe(false);

      // Second candidate can now become leader
      const won2 = await elector2.tryAcquireLeadership();
      expect(won2).toBe(true);
      expect(elector2.isLeader()).toBe(true);
      expect(await elector2.getLeader()).toBe('inst-2');
    });

    it('fails over when leader crashes and lease expires', async () => {
      await elector1.tryAcquireLeadership();
      expect(elector1.isLeader()).toBe(true);

      // Simulate inst-1 crashing: no renew call, lease expires after 150ms
      await new Promise((r) => setTimeout(r, 180));

      expect(elector1.isLeader()).toBe(false);

      // Candidate 2 takes over
      const won2 = await elector2.tryAcquireLeadership();
      expect(won2).toBe(true);
      expect(elector2.isLeader()).toBe(true);
    });
  });
});
