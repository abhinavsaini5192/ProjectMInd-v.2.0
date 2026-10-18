import { describe, it, expect } from 'vitest';
import {
  FeatureHistoryCoordinator,
  DiscoveryHistorySource,
  FeatureChangeHistorySource,
  MappingHistorySource,
  DependencyHistorySource,
  BehaviorHistorySource,
  HealthHistorySource,
  RiskHistorySource,
  ImpactHistorySource,
  ArchitectureHistorySource,
  StatusHistorySource,
  RepositoryHistorySource,
} from '../../../../src/knowledge/features/history/index.js';
import { HistoryTestHelper } from './HistoryTestHelper.js';

describe('History Sources and Correlation', () => {
  it('collects events from all registered sources through coordinator', async () => {
    const coordinator = new FeatureHistoryCoordinator();
    expect(coordinator.getSources().length).toBe(11);

    const context = { featureId: 'auth_service' };
    const events = await coordinator.collectEvents(context);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.source.system === 'DISCOVERY')).toBe(true);
  });

  it('records and returns custom events from each specific source', async () => {
    const mapSrc = new MappingHistorySource();
    const depSrc = new DependencyHistorySource();
    const behSrc = new BehaviorHistorySource();
    const healthSrc = new HealthHistorySource();
    const riskSrc = new RiskHistorySource();
    const impSrc = new ImpactHistorySource();
    const archSrc = new ArchitectureHistorySource();
    const statSrc = new StatusHistorySource();
    const repoSrc = new RepositoryHistorySource();

    const evMap = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_MAPPING_ADDED' });
    const evDep = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_DEPENDENCY_ADDED' });
    const evBeh = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_BEHAVIOR_ADDED' });
    const evHealth = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_HEALTH_CHANGED' });
    const evRisk = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_RISK_CHANGED' });
    const evImp = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_IMPACT_CHANGED' });
    const evArch = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_ARCHITECTURE_CHANGED' });
    const evStat = HistoryTestHelper.createEvent('auth', { eventType: 'FEATURE_STATUS_CHANGED' });

    mapSrc.recordEvent(evMap);
    depSrc.recordEvent(evDep);
    behSrc.recordEvent(evBeh);
    healthSrc.recordEvent(evHealth);
    riskSrc.recordEvent(evRisk);
    impSrc.recordEvent(evImp);
    archSrc.recordEvent(evArch);
    statSrc.recordEvent(evStat);

    const ctx = { featureId: 'auth' };
    expect(await mapSrc.fetchEvents(ctx)).toContainEqual(evMap);
    expect(await depSrc.fetchEvents(ctx)).toContainEqual(evDep);
    expect(await behSrc.fetchEvents(ctx)).toContainEqual(evBeh);
    expect(await healthSrc.fetchEvents(ctx)).toContainEqual(evHealth);
    expect(await riskSrc.fetchEvents(ctx)).toContainEqual(evRisk);
    expect(await impSrc.fetchEvents(ctx)).toContainEqual(evImp);
    expect(await archSrc.fetchEvents(ctx)).toContainEqual(evArch);
    expect(await statSrc.fetchEvents(ctx)).toContainEqual(evStat);
  });

  it('handles git formatting commits in RepositoryHistorySource as non-semantic technical changes', async () => {
    const repoSrc = new RepositoryHistorySource();
    repoSrc.addRecord({
      changeId: 'c1',
      filePath: 'src/auth/AuthService.ts',
      changeType: 'FORMATTING_ONLY',
      isSemantic: false,
      message: 'style: run prettier formatting',
      timestamp: 5000,
    });

    const events = await repoSrc.fetchEvents({ featureId: 'auth' });
    expect(events.length).toBe(1);
    expect(events[0]?.eventType).toBe('TECHNICAL_CHANGE');
    expect(events[0]?.evolutionType).toBe('TECHNICAL');
    expect(events[0]?.metadata?.isSemantic).toBe(false);
  });
});
