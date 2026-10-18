import { describe, it, expect } from 'vitest';
import {
  FeatureHistoryEngine,
  FeatureHistoryRepository,
} from '../../../../src/knowledge/features/history/index.js';
import { HistoryTestHelper } from './HistoryTestHelper.js';

describe('Incremental Updates, Rebuilds, and Storage', () => {
  it('updates only the affected feature history incrementally', async () => {
    const repo = new FeatureHistoryRepository();
    const engine = new FeatureHistoryEngine(repo);

    // Build initial history for auth and payment
    const authHistory = await engine.buildHistory('auth');
    const paymentHistory = await engine.buildHistory('payment');

    expect(authHistory.featureId).toBe('auth');
    expect(paymentHistory.featureId).toBe('payment');

    const initialPaymentTimestamp = paymentHistory.lastUpdatedAt;

    // Incremental event only for auth
    const newAuthEvent = HistoryTestHelper.createEvent('auth', {
      eventType: 'FEATURE_MAPPING_ADDED',
      evolutionType: 'STRUCTURAL',
      timestamp: Date.now() + 5000,
    });

    const updatedList = await engine.updateIncremental([newAuthEvent]);
    expect(updatedList.length).toBe(1);
    expect(updatedList[0]?.featureId).toBe('auth');

    // Payment history in repo should remain untouched
    const retrievedPayment = await engine.getHistory('payment');
    expect(retrievedPayment?.lastUpdatedAt).toBe(initialPaymentTimestamp);
  });

  it('rebuilds history on demand, clearing cached entry', async () => {
    const repo = new FeatureHistoryRepository();
    const engine = new FeatureHistoryEngine(repo);

    const initial = await engine.buildHistory('auth');
    expect(initial).toBeDefined();

    const rebuilt = await engine.rebuildHistory('auth');
    expect(rebuilt).toBeDefined();
    expect(rebuilt.featureId).toBe('auth');
  });

  it('persists and retrieves histories, snapshots, events, and conflicts', async () => {
    const repo = new FeatureHistoryRepository();
    const snap = HistoryTestHelper.createSnapshot('auth', { snapshotId: 'snap_persist_1' });
    const ev = HistoryTestHelper.createEvent('auth', { eventId: 'ev_persist_1' });

    await repo.saveSnapshot(snap);
    await repo.saveEvents([ev]);

    const retrievedSnap = await repo.getSnapshot('auth', 'snap_persist_1');
    expect(retrievedSnap?.snapshotId).toBe('snap_persist_1');

    const retrievedEvents = await repo.getEvents('auth');
    expect(retrievedEvents.length).toBe(1);
    expect(retrievedEvents[0]?.eventId).toBe('ev_persist_1');

    const deleted = await repo.deleteHistory('auth');
    expect(deleted).toBe(false); // No root history was saved, only sub-items
  });
});
