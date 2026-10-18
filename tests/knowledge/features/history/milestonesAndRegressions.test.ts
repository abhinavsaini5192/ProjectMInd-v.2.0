import { describe, it, expect } from 'vitest';
import {
  FeatureMilestoneDetector,
  FeatureTrendAnalyzer,
} from '../../../../src/knowledge/features/history/index.js';
import { HistoryTestHelper } from './HistoryTestHelper.js';

describe('Milestone and Regression Detection', () => {
  it('detects creation and discovery milestones from events', () => {
    const evCreated = HistoryTestHelper.createEvent('auth', {
      eventType: 'FEATURE_CREATED',
      timestamp: 1000,
    });
    const evDiscovered = HistoryTestHelper.createEvent('auth', {
      eventType: 'FEATURE_DISCOVERED',
      timestamp: 1500,
    });

    const detector = new FeatureMilestoneDetector();
    const milestones = detector.detectMilestones('auth', [evCreated, evDiscovered], []);

    expect(milestones.some((m) => m.milestoneType === 'FEATURE_CREATED')).toBe(true);
    expect(milestones.some((m) => m.milestoneType === 'FEATURE_DISCOVERED')).toBe(true);
  });

  it('detects expansion, dependency, health, and stabilization milestones from snapshots', () => {
    const snap1 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 1000,
      resourceCount: 2,
      flowCount: 1,
      dependentCount: 0,
      healthScore: 60,
      riskScore: 40,
      status: 'DISCOVERED',
    });

    const snap2 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 2000,
      resourceCount: 6, // +4 resources -> expansion
      flows: ['login', 'oauth'],
      dependents: ['checkout'], // first dependent -> dependency milestone
      healthScore: 85, // +25 points -> health improvement milestone
      riskScore: 20, // -20 points -> risk reduction milestone
      status: 'ACTIVE', // status changed -> activated milestone
    });

    const snap3 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 3000,
      resourceCount: 6,
      flows: ['login', 'oauth'],
      dependents: ['checkout'],
      healthScore: 85,
      riskScore: 20,
      status: 'ACTIVE',
    });

    const snap4 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 4000,
      resourceCount: 6,
      flows: ['login', 'oauth'],
      dependents: ['checkout'],
      healthScore: 85,
      riskScore: 20,
      status: 'ACTIVE',
    });

    const detector = new FeatureMilestoneDetector();
    const milestones = detector.detectMilestones('auth', [], [snap1, snap2, snap3, snap4]);

    const types = milestones.map((m) => m.milestoneType);
    expect(types).toContain('FEATURE_ACTIVATED');
    expect(types).toContain('FEATURE_EXPANDED');
    expect(types).toContain('FEATURE_DEPENDENCY_EXPANDED');
    expect(types).toContain('FEATURE_HEALTH_IMPROVED');
    expect(types).toContain('FEATURE_RISK_REDUCED');
    expect(types).toContain('FEATURE_STABILIZED');
  });

  it('detects regressions when health drops or behavior flows disappear', () => {
    const snap1 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 1000,
      healthScore: 90,
      riskScore: 15,
      flows: ['login_flow', 'mfa_flow', 'token_refresh'],
      criticalityScore: 20,
    });

    // Health drops 30 points, risk increases 25 points, and mfa_flow disappears
    const snap2 = HistoryTestHelper.createSnapshot('auth', {
      timestamp: 2000,
      healthScore: 60,
      riskScore: 40,
      flows: ['login_flow', 'token_refresh'], // mfa_flow removed
      criticalityScore: 50, // criticality increased while health dropped
    });

    const analyzer = new FeatureTrendAnalyzer();
    const regressions = analyzer.detectRegressions('auth', [snap1, snap2]);

    expect(regressions.length).toBeGreaterThanOrEqual(3);
    const regTypes = regressions.map((r) => r.regressionType);
    expect(regTypes).toContain('HEALTH_DECLINE');
    expect(regTypes).toContain('RISK_ESCALATION');
    expect(regTypes).toContain('BEHAVIOR_FLOW_REMOVED');
    expect(regTypes).toContain('UNVERIFIED_CRITICALITY_INCREASE');
  });
});
