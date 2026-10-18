import type { IAnalyticsAggregator } from '../interfaces/IAnalyticsAggregator.js';
import type { IAnalyticsStore } from '../interfaces/IAnalyticsStore.js';
import type { IMetricRegistry } from '../interfaces/IMetricRegistry.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type {
  TimeWindow,
  AnalyticsSnapshot,
  MetricAggregateResult,
} from '../models/AnalyticsSnapshot.js';
import type {
  AnalyticsQueryResult,
  HistoricalComparisonQuery,
  HistoricalComparisonResult,
  MetricComparisonItem,
  ComparisonTrend,
} from '../models/AnalyticsQuery.js';
import type { AnalyticsDataQuality, DataQualityStatus } from '../models/AnalyticsDataQuality.js';
import type { AnalyticsMetric } from '../models/AnalyticsMetric.js';
import type { IMetricsRegistry } from '../../observability/metrics/MetricTypes.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { ANALYTICS_EVENT_NAMES } from '../events/AnalyticsEvents.js';
import { CORE_METRIC_NAMES } from '../../observability/metrics/CoreMetrics.js';

export class AnalyticsAggregator implements IAnalyticsAggregator {
  constructor(
    private readonly store: IAnalyticsStore,
    private readonly metricRegistry: IMetricRegistry,
    private readonly operationalMetrics?: IMetricsRegistry | undefined,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async aggregate(
    scope: AnalyticsScopeRef,
    window: TimeWindow,
    metricIds?: readonly string[]
  ): Promise<AnalyticsQueryResult> {
    const startTime = Date.now();
    const metricsToCalculate = metricIds && metricIds.length > 0
      ? metricIds.map((id) => this.metricRegistry.getMetric(id)).filter((m): m is AnalyticsMetric => !!m)
      : this.metricRegistry.listMetrics();

    const results: Record<string, MetricAggregateResult> = {};
    let totalRecordsExamined = 0;
    const staleSources: string[] = [];
    const missingMetrics: string[] = [];

    // Optional: ingest operational metric snapshot if querying instance reliability metrics
    const operationalSnapshot = this.operationalMetrics ? this.operationalMetrics.getSnapshot() : undefined;

    for (const metric of metricsToCalculate) {
      // 1. Check if metric comes from operational metrics registry
      if (metric.authoritativeSource === 'MetricsRegistry' && operationalSnapshot) {
        const opResult = this.computeOperationalMetric(metric, operationalSnapshot);
        results[metric.metricId] = opResult;
        if (opResult.status === 'UNAVAILABLE' || opResult.status === 'NOT_COLLECTED') {
          missingMetrics.push(metric.metricId);
        }
        continue;
      }

      // 2. Query stored records
      const records = await this.store.getRecords({
        scope,
        metricIds: [metric.metricId],
        startMs: window.startMs,
        endMs: window.endMs,
      });

      totalRecordsExamined += records.length;

      if (records.length === 0) {
        // Missing data semantics:
        // For COUNT and SUM, if 0 events occurred within window, value is 0 and status is AVAILABLE
        if (metric.aggregationMethod === 'SUM' || metric.aggregationMethod === 'COUNT') {
          results[metric.metricId] = {
            metricId: metric.metricId,
            value: 0,
            status: 'AVAILABLE',
            count: 0,
            sampleCount: 0,
            unit: metric.unit,
            definitionVersion: metric.definitionVersion,
          };
        } else {
          // For AVG, PERCENTAGE, DURATION, RATIO with zero events, status is NOT_APPLICABLE / UNAVAILABLE
          results[metric.metricId] = {
            metricId: metric.metricId,
            value: null,
            status: 'UNAVAILABLE',
            count: 0,
            sampleCount: 0,
            unit: metric.unit,
            definitionVersion: metric.definitionVersion,
          };
          missingMetrics.push(metric.metricId);
        }
        continue;
      }

      // Compute aggregated value
      const values = records.map((r) => r.value);
      const computedValue = this.calculateAggregate(values, metric.aggregationMethod);
      const latestTimestamp = Math.max(...records.map((r) => r.timestamp));
      const freshnessMs = Date.now() - latestTimestamp;

      if (freshnessMs > metric.freshnessSeconds * 1000 * 2) {
        staleSources.push(metric.authoritativeSource);
      }

      results[metric.metricId] = {
        metricId: metric.metricId,
        value: computedValue,
        status: 'AVAILABLE',
        count: values.length,
        sampleCount: values.length,
        unit: metric.unit,
        definitionVersion: metric.definitionVersion,
        sourceFreshnessMs: freshnessMs,
      };
    }

    // Evaluate Data Quality
    const totalMetricsCount = metricsToCalculate.length;
    const availableMetricsCount = Object.values(results).filter((r) => r.status === 'AVAILABLE').length;
    const coverageRatio = totalMetricsCount > 0 ? availableMetricsCount / totalMetricsCount : 1.0;

    const warnings: string[] = [];
    if (coverageRatio < 0.8) {
      warnings.push(`Metric coverage is degraded (${Math.round(coverageRatio * 100)}%). Some sources have not emitted events.`);
    }
    if (staleSources.length > 0) {
      warnings.push(`Stale evidence detected from sources: ${Array.from(new Set(staleSources)).join(', ')}`);
    }

    let qualityStatus: DataQualityStatus = 'HEALTHY';
    if (coverageRatio < 0.5) {
      qualityStatus = 'INCOMPLETE';
    } else if (coverageRatio < 0.8 || staleSources.length > 0) {
      qualityStatus = 'DEGRADED';
    }

    const dataQuality: AnalyticsDataQuality = {
      status: qualityStatus,
      coverageRatio: Math.round(coverageRatio * 100) / 100,
      warnings,
      missingMetrics: Array.from(new Set(missingMetrics)),
      staleSources: Array.from(new Set(staleSources)),
      evaluatedAt: Date.now(),
    };

    return {
      scope,
      timeWindow: window,
      metrics: results,
      dataQuality,
      totalRecordsExamined,
      executionDurationMs: Date.now() - startTime,
    };
  }

  public async generateSnapshot(
    scope: AnalyticsScopeRef,
    window: TimeWindow
  ): Promise<AnalyticsSnapshot> {
    const aggResult = await this.aggregate(scope, window);
    const snapshot: AnalyticsSnapshot = {
      snapshotId: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      scope,
      timeWindow: window,
      metrics: aggResult.metrics,
      dataQuality: aggResult.dataQuality,
    };

    await this.store.saveSnapshot(snapshot);

    if (this.eventBus) {
      this.eventBus.publish(ANALYTICS_EVENT_NAMES.SNAPSHOT_GENERATED, {
        snapshotId: snapshot.snapshotId,
        scope,
        timeWindow: window,
        metricCount: Object.keys(snapshot.metrics).length,
        generatedAt: snapshot.timestamp,
      });
    }

    return snapshot;
  }

  public async compareWindows(
    query: HistoricalComparisonQuery
  ): Promise<HistoricalComparisonResult> {
    const baseAgg = await this.aggregate(query.scope, query.baseWindow, query.metricIds);
    const compareAgg = await this.aggregate(query.scope, query.compareWindow, query.metricIds);

    const comparisons: Record<string, MetricComparisonItem> = {};

    const allMetricIds = Array.from(
      new Set([...Object.keys(baseAgg.metrics), ...Object.keys(compareAgg.metrics)])
    );

    for (const metricId of allMetricIds) {
      const base = baseAgg.metrics[metricId]?.value ?? null;
      const compare = compareAgg.metrics[metricId]?.value ?? null;

      let absoluteDelta: number | null = null;
      let percentageDelta: number | null = null;
      let trend: ComparisonTrend = 'INSUFFICIENT_DATA';

      if (base !== null && compare !== null) {
        absoluteDelta = Math.round((compare - base) * 1000) / 1000;
        percentageDelta = base !== 0 ? Math.round(((compare - base) / Math.abs(base)) * 10000) / 100 : null;

        const isNegativeMetric =
          metricId.includes('failure') ||
          metricId.includes('error') ||
          metricId.includes('timeout') ||
          metricId.includes('denial') ||
          metricId.includes('violation');

        if (absoluteDelta === 0) {
          trend = 'UNCHANGED';
        } else if (isNegativeMetric) {
          trend = absoluteDelta < 0 ? 'IMPROVED' : 'DEGRADED';
        } else {
          trend = absoluteDelta > 0 ? 'IMPROVED' : 'DEGRADED';
        }
      }

      comparisons[metricId] = {
        metricId,
        baseValue: base,
        compareValue: compare,
        absoluteDelta,
        percentageDelta,
        trend,
      };
    }

    return {
      scope: query.scope,
      baseWindow: query.baseWindow,
      compareWindow: query.compareWindow,
      comparisons,
      generatedAt: Date.now(),
    };
  }

  private calculateAggregate(values: readonly number[], method: string): number {
    if (values.length === 0) return 0;

    switch (method) {
      case 'SUM':
      case 'COUNT':
        return values.reduce((acc, v) => acc + v, 0);

      case 'AVG': {
        const sum = values.reduce((acc, v) => acc + v, 0);
        return Math.round((sum / values.length) * 100) / 100;
      }

      case 'LATEST':
        return values[values.length - 1] ?? 0;

      case 'MIN':
        return Math.min(...values);

      case 'MAX':
        return Math.max(...values);

      case 'P50': {
        const sorted = [...values].sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * 0.5);
        return sorted[idx] ?? 0;
      }

      case 'P90': {
        const sorted = [...values].sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * 0.9);
        return sorted[idx] ?? 0;
      }

      case 'P99': {
        const sorted = [...values].sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
        return sorted[idx] ?? 0;
      }

      default:
        return values.reduce((acc, v) => acc + v, 0);
    }
  }

  private computeOperationalMetric(
    metric: AnalyticsMetric,
    snapshot: any
  ): MetricAggregateResult {
    switch (metric.metricId) {
      case 'reliability.api_requests.count': {
        const reqCounter = snapshot.counters[CORE_METRIC_NAMES.API_REQUESTS_TOTAL];
        const val = reqCounter?.series.reduce((s: number, x: any) => s + x.value, 0) ?? 0;
        return {
          metricId: metric.metricId,
          value: val,
          status: 'AVAILABLE',
          count: val,
          sampleCount: 1,
          unit: metric.unit,
          definitionVersion: metric.definitionVersion,
        };
      }
      case 'reliability.error_rate.percentage': {
        const reqCounter = snapshot.counters[CORE_METRIC_NAMES.API_REQUESTS_TOTAL];
        const totalReqs = reqCounter?.series.reduce((s: number, x: any) => s + x.value, 0) ?? 0;
        const errCounter = snapshot.counters[CORE_METRIC_NAMES.API_ERRORS_TOTAL];
        const totalErrs = errCounter?.series.reduce((s: number, x: any) => s + x.value, 0) ?? 0;

        if (totalReqs === 0) {
          return {
            metricId: metric.metricId,
            value: null,
            status: 'UNAVAILABLE',
            count: 0,
            sampleCount: 0,
            unit: metric.unit,
            definitionVersion: metric.definitionVersion,
          };
        }
        const errRate = Math.round((totalErrs / totalReqs) * 10000) / 100;
        return {
          metricId: metric.metricId,
          value: errRate,
          status: 'AVAILABLE',
          count: totalReqs,
          sampleCount: 1,
          unit: metric.unit,
          definitionVersion: metric.definitionVersion,
        };
      }
      case 'reliability.api_latency.p95_ms': {
        const latencyHisto = snapshot.histograms[CORE_METRIC_NAMES.API_REQUEST_DURATION_MS];
        const p95 = latencyHisto?.series[0]?.value?.p95 ?? null;
        return {
          metricId: metric.metricId,
          value: p95,
          status: p95 !== null ? 'AVAILABLE' : 'UNAVAILABLE',
          count: latencyHisto?.series[0]?.value?.count ?? 0,
          sampleCount: 1,
          unit: metric.unit,
          definitionVersion: metric.definitionVersion,
        };
      }
      default:
        return {
          metricId: metric.metricId,
          value: null,
          status: 'UNAVAILABLE',
          count: 0,
          sampleCount: 0,
          unit: metric.unit,
          definitionVersion: metric.definitionVersion,
        };
    }
  }
}
