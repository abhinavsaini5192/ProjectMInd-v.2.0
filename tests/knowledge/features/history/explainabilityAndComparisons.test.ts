import { describe, it, expect } from 'vitest';
import {
  FeatureHistoryExplainer,
  FeatureHistoryEngine,
} from '../../../../src/knowledge/features/history/index.js';
import { HistoryTestHelper } from './HistoryTestHelper.js';

describe('Explainability and Historical Comparisons', () => {
  it('compares two snapshots and extracts precise deltas', () => {
    const snap1 = HistoryTestHelper.createSnapshot('auth', {
      snapshotId: 's1',
      timestamp: 1000,
      primaryPath: 'src/auth/Login.ts',
      dependencies: ['dep_a'],
      flows: ['flow_login'],
      entryPoints: ['/login'],
      healthScore: 70,
      riskScore: 30,
      criticalityLevel: 'LOW',
    });

    const snap2 = HistoryTestHelper.createSnapshot('auth', {
      snapshotId: 's2',
      timestamp: 2000,
      primaryPath: 'src/auth/AuthService.ts', // Mapping changed
      dependencies: ['dep_a', 'dep_oauth'], // +dep_oauth
      flows: ['flow_login', 'flow_oauth'], // +flow_oauth
      entryPoints: ['/login', '/oauth/callback'], // +/oauth/callback
      healthScore: 90, // +20 points
      riskScore: 15, // -15 points
      criticalityLevel: 'HIGH',
    });

    const explainer = new FeatureHistoryExplainer();
    const comparison = explainer.compareSnapshots('auth', snap1, snap2);

    expect(comparison.mappingsAdded).toContain('src/auth/AuthService.ts');
    expect(comparison.mappingsRemoved).toContain('src/auth/Login.ts');
    expect(comparison.dependenciesAdded).toEqual(['dep_oauth']);
    expect(comparison.flowsAdded).toEqual(['flow_oauth']);
    expect(comparison.entryPointsAdded).toEqual(['/oauth/callback']);
    expect(comparison.healthDelta.delta).toBe(20);
    expect(comparison.riskDelta.delta).toBe(-15);
    expect(comparison.criticalityChange.beforeLevel).toBe('LOW');
    expect(comparison.criticalityChange.afterLevel).toBe('HIGH');
  });

  it('generates structured evolution explanation answering key questions', async () => {
    const engine = new FeatureHistoryEngine();
    const history = await engine.buildHistory('auth');

    const explainer = engine.getExplainer();
    const summary = explainer.explainEvolution('auth', history);

    expect(summary.featureId).toBe('auth');
    expect(summary.textSummary).toContain('auth:');
    expect(summary.textSummary).toContain('Major milestones:');
    expect(summary.textSummary).toContain('Current trends:');
    expect(summary.textSummary).toContain('Current maturity:');

    const critExplanation = explainer.explainCriticalityChange('auth', history);
    expect(critExplanation).toContain('criticality primarily because');

    const riskExplanation = explainer.explainRiskChange('auth', history);
    expect(riskExplanation).toContain('risk score');
  });
});
