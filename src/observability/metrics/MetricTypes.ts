export type MetricType = 'COUNTER' | 'GAUGE' | 'HISTOGRAM';

export type MetricLabels = Record<string, string | number | boolean>;

export interface HistogramStats {
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly avg: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
}

export interface ICounter {
  readonly name: string;
  readonly description?: string | undefined;
  increment(value?: number, labels?: MetricLabels): void;
  getValue(labels?: MetricLabels): number;
}

export interface IGauge {
  readonly name: string;
  readonly description?: string | undefined;
  set(value: number, labels?: MetricLabels): void;
  getValue(labels?: MetricLabels): number;
}

export interface IHistogram {
  readonly name: string;
  readonly description?: string | undefined;
  record(value: number, labels?: MetricLabels): void;
  getStats(labels?: MetricLabels): HistogramStats;
}

export interface MetricSeriesSnapshot<T> {
  readonly labels: Record<string, string>;
  readonly value: T;
}

export interface MetricsSnapshot {
  readonly timestamp: string;
  readonly counters: Record<string, { description?: string | undefined; series: readonly MetricSeriesSnapshot<number>[] }>;
  readonly gauges: Record<string, { description?: string | undefined; series: readonly MetricSeriesSnapshot<number>[] }>;
  readonly histograms: Record<string, { description?: string | undefined; series: readonly MetricSeriesSnapshot<HistogramStats>[] }>;
}

export interface IMetricsRegistry {
  counter(name: string, description?: string): ICounter;
  gauge(name: string, description?: string): IGauge;
  histogram(name: string, description?: string, buckets?: readonly number[]): IHistogram;
  getSnapshot(): MetricsSnapshot;
  reset(): void;
}

export const IMetricsRegistryToken = Symbol('IMetricsRegistry');
