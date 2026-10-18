import type { IMetricRegistry } from '../interfaces/IMetricRegistry.js';
import type { AnalyticsCategory } from '../models/AnalyticsCategory.js';
import type { AnalyticsMetric } from '../models/AnalyticsMetric.js';
import {
  InvalidMetricDefinitionError,
  IncompatibleMetricVersionError,
} from '../errors/AnalyticsError.js';
import { STANDARD_METRICS } from './StandardMetrics.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { ANALYTICS_EVENT_NAMES } from '../events/AnalyticsEvents.js';

export class MetricRegistry implements IMetricRegistry {
  private readonly metrics = new Map<string, AnalyticsMetric>();

  constructor(
    private readonly eventBus?: IEventBus | undefined,
    registerDefaults: boolean = true
  ) {
    if (registerDefaults) {
      for (const m of STANDARD_METRICS) {
        this.registerMetric(m);
      }
    }
  }

  public registerMetric(metric: AnalyticsMetric): void {
    this.validateMetricDefinition(metric);

    const existing = this.metrics.get(metric.metricId);
    if (existing) {
      if (existing.definitionVersion !== metric.definitionVersion) {
        // Enforce version compatibility checks
        const existingMajor = parseInt(existing.definitionVersion.split('.')[0] || '1', 10);
        const newMajor = parseInt(metric.definitionVersion.split('.')[0] || '1', 10);
        if (existingMajor !== newMajor) {
          throw new IncompatibleMetricVersionError(
            metric.metricId,
            existing.definitionVersion,
            metric.definitionVersion
          );
        }
      }
    }

    this.metrics.set(metric.metricId, Object.freeze({ ...metric }));

    if (this.eventBus) {
      this.eventBus.publish(ANALYTICS_EVENT_NAMES.METRIC_REGISTERED, {
        metricId: metric.metricId,
        category: metric.category,
        version: metric.definitionVersion,
        registeredAt: Date.now(),
      });
    }
  }

  public getMetric(metricId: string): AnalyticsMetric | undefined {
    return this.metrics.get(metricId);
  }

  public hasMetric(metricId: string): boolean {
    return this.metrics.has(metricId);
  }

  public listMetrics(category?: AnalyticsCategory): readonly AnalyticsMetric[] {
    const all = Array.from(this.metrics.values());
    if (!category) {
      return all;
    }
    return all.filter((m) => m.category === category);
  }

  private validateMetricDefinition(metric: AnalyticsMetric): void {
    if (!metric.metricId || typeof metric.metricId !== 'string' || !metric.metricId.trim()) {
      throw new InvalidMetricDefinitionError('Metric metricId must be a non-empty string');
    }
    if (!metric.name || typeof metric.name !== 'string' || !metric.name.trim()) {
      throw new InvalidMetricDefinitionError(`Metric '${metric.metricId}' has invalid name`);
    }
    if (!metric.category || typeof metric.category !== 'string') {
      throw new InvalidMetricDefinitionError(`Metric '${metric.metricId}' has missing category`);
    }
    if (!metric.valueType || typeof metric.valueType !== 'string') {
      throw new InvalidMetricDefinitionError(`Metric '${metric.metricId}' has missing valueType`);
    }
    if (!metric.unit || typeof metric.unit !== 'string') {
      throw new InvalidMetricDefinitionError(`Metric '${metric.metricId}' has missing unit`);
    }
    if (!metric.definitionVersion || !/^\d+\.\d+\.\d+$/.test(metric.definitionVersion)) {
      throw new InvalidMetricDefinitionError(
        `Metric '${metric.metricId}' has invalid definitionVersion '${metric.definitionVersion}'. Must be semver (x.y.z)`
      );
    }
    if (!Array.isArray(metric.supportedScopes) || metric.supportedScopes.length === 0) {
      throw new InvalidMetricDefinitionError(
        `Metric '${metric.metricId}' must specify at least one supportedScope`
      );
    }
    if (!metric.authoritativeSource || typeof metric.authoritativeSource !== 'string') {
      throw new InvalidMetricDefinitionError(
        `Metric '${metric.metricId}' has missing authoritativeSource`
      );
    }
    if (metric.freshnessSeconds <= 0) {
      throw new InvalidMetricDefinitionError(
        `Metric '${metric.metricId}' freshnessSeconds must be positive`
      );
    }
  }
}
