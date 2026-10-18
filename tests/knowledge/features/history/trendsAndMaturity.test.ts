import { describe, it, expect } from 'vitest';
import {
  FeatureTrendAnalyzer,
  FeatureTimelineAggregator,
} from '../../../../src/knowledge/features/history/index.js';
import { HistoryTestHelper } from './HistoryTestHelper.js';

describe('Trends and Maturity Analysis', () => {
  it('returns UNKNOWN trend if only 1 observation is available', () => {
    const snap1 = HistoryTestHelper.createSnapshot('auth');
    const analyzer = new FeatureTrendAnalyzer();
    const timeline = new FeatureTimelineAggregator().aggregateTimeline('auth', [], [], []);

    const trends = analyzer.analyzeTrends('auth', [snap1], timeline);
    expect(trends.length).toBe(1);
    expect(trends[0]?.trendType).toBe('UNKNOWN');
  });

  it('detects multiple trends across multiple observations', () => {
    const snap1 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 1000,
      resourceCount: 2,
      healthScore: 60,
      riskScore: 40,
      criticalityLevel: 'LOW',
    });
    const snap2 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 2000,
      resourceCount: 5, // GROWING
      healthScore: 80, // IMPROVING_HEALTH
      riskScore: 20, // DECLINING_RISK
      criticalityLevel: 'HIGH', // INCREASING_CRITICALITY
    });

    const analyzer = new FeatureTrendAnalyzer();
    const timeline = new FeatureTimelineAggregator().aggregateTimeline('auth', [], [], []);
    const trends = analyzer.analyzeTrends('auth', [snap1, snap2], timeline);

    const trendTypes = trends.map((t) => t.trendType);
    expect(trendTypes).toContain('GROWING');
    expect(trendTypes).toContain('IMPROVING_HEALTH');
    expect(trendTypes).toContain('DECLINING_RISK');
    expect(trendTypes).toContain('INCREASING_CRITICALITY');
  });

  it('determines maturity using stability, verification, and topology rather than age alone', () => {
    const analyzer = new FeatureTrendAnalyzer();

    // Case 1: Old feature with poor verification and high risk -> should NOT be MATURE
    const oldUnstableSnap1 = HistoryTestHelper.createSnapshot('legacy_feature', {
      timestamp: 1000,
      healthScore: 30,
      riskScore: 80,
    });
    const oldUnstableSnap2 = HistoryTestHelper.createSnapshot('legacy_feature', {
      timestamp: 1000 + 365 * 24 * 3600 * 1000, // 1 year later
      healthScore: 30,
      riskScore: 80,
    });

    const maturityOld = analyzer.determineMaturity('legacy_feature', [oldUnstableSnap1, oldUnstableSnap2], []);
    expect(maturityOld.level).not.toBe('MATURE');
    expect(maturityOld.level).not.toBe('ESTABLISHED');

    // Case 2: Highly stable, high verification, multiple snapshots -> MATURE
    const matureSnap1 = HistoryTestHelper.createSnapshot('core_auth', { timestamp: 1000, healthScore: 95, riskScore: 10, dependentCount: 2 });
    const matureSnap2 = HistoryTestHelper.createSnapshot('core_auth', { timestamp: 2000, healthScore: 95, riskScore: 10, dependentCount: 2 });
    const matureSnap3 = HistoryTestHelper.createSnapshot('core_auth', { timestamp: 3000, healthScore: 95, riskScore: 10, dependentCount: 2 });

    const maturityNew = analyzer.determineMaturity('core_auth', [matureSnap1, matureSnap2, matureSnap3], []);
    expect(maturityNew.level).toBe('MATURE');
    expect(maturityNew.score).toBeGreaterThanOrEqual(80);
  });

  it('computes growth metrics with deltas and normalized deltas', () => {
    const snap1 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 1000,
      resourceCount: 4,
      healthScore: 70,
    });
    const snap2 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 2000,
      resourceCount: 8,
      healthScore: 90,
    });

    const analyzer = new FeatureTrendAnalyzer();
    const growth = analyzer.calculateGrowthMetrics('auth', [snap1, snap2]);

    expect(growth.metrics.resourceCount?.currentValue).toBe(8);
    expect(growth.metrics.resourceCount?.previousValue).toBe(4);
    expect(growth.metrics.resourceCount?.delta).toBe(4);
    expect(growth.metrics.resourceCount?.normalizedDelta).toBe(1.0); // 100% growth

    expect(growth.metrics.healthScore?.delta).toBe(20);
  });
});
