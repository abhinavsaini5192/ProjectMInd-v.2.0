import { describe, it, expect } from 'vitest';
import {
  FeatureTimelineAggregator,
  FeatureVersionResolver,
} from '../../../../src/knowledge/features/history/index.js';
import { HistoryTestHelper } from './HistoryTestHelper.js';

describe('Feature Timeline and Version Resolution', () => {
  it('aggregates timeline and excludes non-semantic events from meaningfulEventCount', () => {
    const t0 = 5000;
    const evSemantic = HistoryTestHelper.createEvent('auth', {
      eventType: 'FEATURE_MAPPING_ADDED',
      evolutionType: 'STRUCTURAL',
      timestamp: t0,
    });
    const evTechnical = HistoryTestHelper.createEvent('auth', {
      eventType: 'TECHNICAL_CHANGE',
      evolutionType: 'TECHNICAL',
      timestamp: t0 + 1000,
    });

    const aggregator = new FeatureTimelineAggregator();
    const timeline = aggregator.aggregateTimeline('auth', [evSemantic, evTechnical], [], []);

    expect(timeline.eventCount).toBe(2);
    expect(timeline.meaningfulEventCount).toBe(1);
    expect(timeline.startTime).toBe(t0);
    expect(timeline.endTime).toBe(t0 + 1000);
  });

  it('resolves semantic versions when meaningful changes occur', () => {
    const snap1 = HistoryTestHelper.createSnapshot('auth', {
      snapshotId: 'snap_v1',
      version: 1,
      timestamp: 1000,
      entryPointCount: 1,
      flowCount: 1,
    });

    // Substantial change: new entry point added
    const snap2 = HistoryTestHelper.createSnapshot('auth', {
      snapshotId: 'snap_v2',
      version: 2,
      timestamp: 2000,
      entryPoints: ['/login', '/oauth/callback'],
      flows: ['login_flow', 'oauth_flow'],
    });

    // Insignificant change: identical metadata, no new flows/endpoints
    const snap3 = HistoryTestHelper.createSnapshot('auth', {
      snapshotId: 'snap_v3',
      version: 3,
      timestamp: 3000,
      entryPoints: ['/login', '/oauth/callback'],
      flows: ['login_flow', 'oauth_flow'],
    });

    const resolver = new FeatureVersionResolver();
    const timeline = new FeatureTimelineAggregator().aggregateTimeline('auth', [], [], []);
    const versions = resolver.resolveVersions('auth', timeline, [snap1, snap2, snap3]);

    expect(versions.length).toBe(2);
    expect(versions[0]?.semanticVersion).toBe(1);
    expect(versions[1]?.semanticVersion).toBe(2);
    expect(versions[1]?.reason).toContain('entry point');
  });
});
