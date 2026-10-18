import { describe, it, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../../src/analytics/registry/MetricRegistry.js';
import { STANDARD_METRICS } from '../../src/analytics/registry/StandardMetrics.js';
import {
  InvalidMetricDefinitionError,
  IncompatibleMetricVersionError,
} from '../../src/analytics/errors/AnalyticsError.js';
import type { AnalyticsMetric } from '../../src/analytics/models/AnalyticsMetric.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { ANALYTICS_EVENT_NAMES } from '../../src/analytics/events/AnalyticsEvents.js';

describe('Phase 9.9 — Metric Registry & Validation', () => {
  let eventBus: NodeEventBus;
  let registry: MetricRegistry;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    registry = new MetricRegistry(eventBus, true);
  });

  it('Scenario 1: should register standard canonical metrics on startup', () => {
    const all = registry.listMetrics();
    expect(all.length).toBeGreaterThanOrEqual(40);

    const usageMetrics = registry.listMetrics('PLATFORM_USAGE');
    expect(usageMetrics.length).toBeGreaterThan(0);
    expect(registry.hasMetric('usage.context_requests.count')).toBe(true);

    const m = registry.getMetric('usage.context_requests.count');
    expect(m).toBeDefined();
    expect(m?.unit).toBe('requests');
    expect(m?.authoritativeSource).toBe('ContextOrchestrator');
  });

  it('Scenario 2: should reject invalid metric definitions', () => {
    // Missing ID
    expect(() =>
      registry.registerMetric({
        metricId: '',
        name: 'Empty ID',
        description: 'Test',
        category: 'PLATFORM_USAGE',
        valueType: 'NUMBER',
        unit: 'count',
        definitionVersion: '1.0.0',
        supportedScopes: ['INSTANCE'],
        authoritativeSource: 'Test',
        aggregationMethod: 'SUM',
        freshnessSeconds: 60,
        privacyClassification: 'INTERNAL',
      })
    ).toThrow(InvalidMetricDefinitionError);

    // Invalid Semver
    expect(() =>
      registry.registerMetric({
        metricId: 'custom.invalid_version',
        name: 'Invalid Version',
        description: 'Test',
        category: 'PLATFORM_USAGE',
        valueType: 'NUMBER',
        unit: 'count',
        definitionVersion: 'v1-beta',
        supportedScopes: ['INSTANCE'],
        authoritativeSource: 'Test',
        aggregationMethod: 'SUM',
        freshnessSeconds: 60,
        privacyClassification: 'INTERNAL',
      })
    ).toThrow(InvalidMetricDefinitionError);

    // Empty scopes
    expect(() =>
      registry.registerMetric({
        metricId: 'custom.empty_scopes',
        name: 'Empty Scopes',
        description: 'Test',
        category: 'PLATFORM_USAGE',
        valueType: 'NUMBER',
        unit: 'count',
        definitionVersion: '1.0.0',
        supportedScopes: [],
        authoritativeSource: 'Test',
        aggregationMethod: 'SUM',
        freshnessSeconds: 60,
        privacyClassification: 'INTERNAL',
      })
    ).toThrow(InvalidMetricDefinitionError);

    // Non-positive freshness
    expect(() =>
      registry.registerMetric({
        metricId: 'custom.invalid_freshness',
        name: 'Invalid Freshness',
        description: 'Test',
        category: 'PLATFORM_USAGE',
        valueType: 'NUMBER',
        unit: 'count',
        definitionVersion: '1.0.0',
        supportedScopes: ['WORKSPACE'],
        authoritativeSource: 'Test',
        aggregationMethod: 'SUM',
        freshnessSeconds: -10,
        privacyClassification: 'INTERNAL',
      })
    ).toThrow(InvalidMetricDefinitionError);
  });

  it('Scenario 3: should enforce semver version compatibility on metric update', () => {
    let eventFired = false;
    eventBus.subscribe(ANALYTICS_EVENT_NAMES.METRIC_REGISTERED, (e) => {
      if ((e as any).payload?.metricId === 'custom.evolution') {
        eventFired = true;
      }
    });

    const v1: AnalyticsMetric = {
      metricId: 'custom.evolution',
      name: 'Evolving Metric',
      description: 'Initial version',
      category: 'RELIABILITY_AND_OPERATIONS',
      valueType: 'NUMBER',
      unit: 'count',
      definitionVersion: '1.0.0',
      supportedScopes: ['INSTANCE', 'WORKSPACE'],
      authoritativeSource: 'CustomEngine',
      aggregationMethod: 'SUM',
      freshnessSeconds: 60,
      privacyClassification: 'INTERNAL',
    };

    registry.registerMetric(v1);
    expect(eventFired).toBe(true);

    // Compatible minor version update (1.1.0)
    const v1_1: AnalyticsMetric = {
      ...v1,
      description: 'Minor compatible update',
      definitionVersion: '1.1.0',
    };
    expect(() => registry.registerMetric(v1_1)).not.toThrow();
    expect(registry.getMetric('custom.evolution')?.definitionVersion).toBe('1.1.0');

    // Incompatible breaking major version update (2.0.0) without explicit migration
    const v2: AnalyticsMetric = {
      ...v1,
      description: 'Breaking change',
      definitionVersion: '2.0.0',
    };
    expect(() => registry.registerMetric(v2)).toThrow(IncompatibleMetricVersionError);
  });
});
