import type {
  ICounter,
  IGauge,
  IHistogram,
  IMetricsRegistry,
  MetricLabels,
  HistogramStats,
  MetricsSnapshot,
  MetricSeriesSnapshot,
} from './MetricTypes.js';

export interface MetricsRegistryOptions {
  readonly maxCardinalityPerMetric?: number | undefined;
  readonly maxHistogramSamples?: number | undefined;
}

const FORBIDDEN_LABEL_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'prompt',
  'user_input',
  'code',
  'source',
  'filepath',
  'file_path',
  'path',
]);

function sanitizeLabels(labels?: MetricLabels): Record<string, string> {
  if (!labels || Object.keys(labels).length === 0) {
    return {};
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels)) {
    const keyLower = k.toLowerCase();
    if (FORBIDDEN_LABEL_KEYS.has(keyLower)) {
      continue; // drop forbidden high-cardinality/sensitive labels
    }
    const strVal = String(v);
    // bound length to 64 chars
    clean[k] = strVal.length > 64 ? strVal.substring(0, 64) : strVal;
  }
  return clean;
}

function labelKey(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) {
    return '';
  }
  return keys.map((k) => `${k}=${labels[k]}`).join(',');
}

class CounterImpl implements ICounter {
  public readonly name: string;
  public readonly description?: string | undefined;
  private readonly values = new Map<string, { labels: Record<string, string>; value: number }>();
  private readonly maxCardinality: number;

  constructor(name: string, description: string | undefined, maxCardinality: number) {
    this.name = name;
    this.description = description;
    this.maxCardinality = maxCardinality;
  }

  public increment(value: number = 1, labels?: MetricLabels): void {
    try {
      const clean = sanitizeLabels(labels);
      const key = labelKey(clean);

      const existing = this.values.get(key);
      if (existing) {
        existing.value += value;
      } else {
        if (this.values.size >= this.maxCardinality) {
          // Bounded cardinality fallback
          const overflowKey = '__overflow__=true';
          const overflow = this.values.get(overflowKey);
          if (overflow) {
            overflow.value += value;
          } else {
            this.values.set(overflowKey, { labels: { __overflow__: 'true' }, value });
          }
          return;
        }
        this.values.set(key, { labels: clean, value });
      }
    } catch {
      // Telemetry failure isolation
    }
  }

  public getValue(labels?: MetricLabels): number {
    const clean = sanitizeLabels(labels);
    const key = labelKey(clean);
    return this.values.get(key)?.value ?? 0;
  }

  public getSeries(): MetricSeriesSnapshot<number>[] {
    return Array.from(this.values.values()).map((v) => ({
      labels: v.labels,
      value: v.value,
    }));
  }

  public reset(): void {
    this.values.clear();
  }
}

class GaugeImpl implements IGauge {
  public readonly name: string;
  public readonly description?: string | undefined;
  private readonly values = new Map<string, { labels: Record<string, string>; value: number }>();
  private readonly maxCardinality: number;

  constructor(name: string, description: string | undefined, maxCardinality: number) {
    this.name = name;
    this.description = description;
    this.maxCardinality = maxCardinality;
  }

  public set(value: number, labels?: MetricLabels): void {
    try {
      const clean = sanitizeLabels(labels);
      const key = labelKey(clean);

      const existing = this.values.get(key);
      if (existing) {
        existing.value = value;
      } else {
        if (this.values.size >= this.maxCardinality) {
          const overflowKey = '__overflow__=true';
          this.values.set(overflowKey, { labels: { __overflow__: 'true' }, value });
          return;
        }
        this.values.set(key, { labels: clean, value });
      }
    } catch {
      // Telemetry failure isolation
    }
  }

  public getValue(labels?: MetricLabels): number {
    const clean = sanitizeLabels(labels);
    const key = labelKey(clean);
    return this.values.get(key)?.value ?? 0;
  }

  public getSeries(): MetricSeriesSnapshot<number>[] {
    return Array.from(this.values.values()).map((v) => ({
      labels: v.labels,
      value: v.value,
    }));
  }

  public reset(): void {
    this.values.clear();
  }
}

class HistogramImpl implements IHistogram {
  public readonly name: string;
  public readonly description?: string | undefined;
  private readonly buckets?: readonly number[] | undefined;
  private readonly maxSamples: number;
  private readonly maxCardinality: number;
  private readonly series = new Map<
    string,
    {
      labels: Record<string, string>;
      count: number;
      sum: number;
      min: number;
      max: number;
      samples: number[];
    }
  >();

  constructor(
    name: string,
    description: string | undefined,
    buckets: readonly number[] | undefined,
    maxCardinality: number,
    maxSamples: number
  ) {
    this.name = name;
    this.description = description;
    this.buckets = buckets;
    this.maxCardinality = maxCardinality;
    this.maxSamples = maxSamples;
  }

  public record(value: number, labels?: MetricLabels): void {
    try {
      const clean = sanitizeLabels(labels);
      const key = labelKey(clean);

      let record = this.series.get(key);
      if (!record) {
        if (this.series.size >= this.maxCardinality) {
          const overflowKey = '__overflow__=true';
          record = this.series.get(overflowKey);
          if (!record) {
            record = {
              labels: { __overflow__: 'true' },
              count: 0,
              sum: 0,
              min: value,
              max: value,
              samples: [],
            };
            this.series.set(overflowKey, record);
          }
        } else {
          record = {
            labels: clean,
            count: 0,
            sum: 0,
            min: value,
            max: value,
            samples: [],
          };
          this.series.set(key, record);
        }
      }

      record.count += 1;
      record.sum += value;
      if (value < record.min) record.min = value;
      if (value > record.max) record.max = value;

      record.samples.push(value);
      if (record.samples.length > this.maxSamples) {
        record.samples.shift();
      }
    } catch {
      // Telemetry failure isolation
    }
  }

  public getStats(labels?: MetricLabels): HistogramStats {
    const clean = sanitizeLabels(labels);
    const key = labelKey(clean);
    const record = this.series.get(key);

    if (!record || record.count === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...record.samples].sort((a, b) => a - b);
    const p = (pct: number) => {
      if (sorted.length === 0) return 0;
      const index = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
      return sorted[index];
    };

    return {
      count: record.count,
      sum: record.sum,
      min: record.min,
      max: record.max,
      avg: Math.round((record.sum / record.count) * 100) / 100,
      p50: p(50),
      p90: p(90),
      p95: p(95),
      p99: p(99),
    };
  }

  public getSeries(): MetricSeriesSnapshot<HistogramStats>[] {
    return Array.from(this.series.values()).map((r) => ({
      labels: r.labels,
      value: this.getStats(r.labels),
    }));
  }

  public reset(): void {
    this.series.clear();
  }
}

export class MetricsRegistry implements IMetricsRegistry {
  private readonly counters = new Map<string, CounterImpl>();
  private readonly gauges = new Map<string, GaugeImpl>();
  private readonly histograms = new Map<string, HistogramImpl>();
  private readonly maxCardinality: number;
  private readonly maxHistogramSamples: number;

  constructor(options: MetricsRegistryOptions = {}) {
    this.maxCardinality = options.maxCardinalityPerMetric ?? 100;
    this.maxHistogramSamples = options.maxHistogramSamples ?? 1000;
  }

  public counter(name: string, description?: string): ICounter {
    let c = this.counters.get(name);
    if (!c) {
      c = new CounterImpl(name, description, this.maxCardinality);
      this.counters.set(name, c);
    }
    return c;
  }

  public gauge(name: string, description?: string): IGauge {
    let g = this.gauges.get(name);
    if (!g) {
      g = new GaugeImpl(name, description, this.maxCardinality);
      this.gauges.set(name, g);
    }
    return g;
  }

  public histogram(name: string, description?: string, buckets?: readonly number[]): IHistogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new HistogramImpl(name, description, buckets, this.maxCardinality, this.maxHistogramSamples);
      this.histograms.set(name, h);
    }
    return h;
  }

  public getSnapshot(): MetricsSnapshot {
    const counters: Record<string, { description?: string | undefined; series: readonly MetricSeriesSnapshot<number>[] }> = {};
    for (const [name, c] of this.counters.entries()) {
      counters[name] = { description: c.description, series: c.getSeries() };
    }

    const gauges: Record<string, { description?: string | undefined; series: readonly MetricSeriesSnapshot<number>[] }> = {};
    for (const [name, g] of this.gauges.entries()) {
      gauges[name] = { description: g.description, series: g.getSeries() };
    }

    const histograms: Record<string, { description?: string | undefined; series: readonly MetricSeriesSnapshot<HistogramStats>[] }> = {};
    for (const [name, h] of this.histograms.entries()) {
      histograms[name] = { description: h.description, series: h.getSeries() };
    }

    return {
      timestamp: new Date().toISOString(),
      counters,
      gauges,
      histograms,
    };
  }

  public reset(): void {
    for (const c of this.counters.values()) c.reset();
    for (const g of this.gauges.values()) g.reset();
    for (const h of this.histograms.values()) h.reset();
  }
}

export const defaultMetricsRegistry = new MetricsRegistry();
