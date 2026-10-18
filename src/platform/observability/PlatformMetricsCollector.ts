export interface MetricDimensionFilter {
  readonly allowedOperations?: readonly string[] | undefined;
  readonly allowedAdapters?: readonly string[] | undefined;
  readonly allowedProtocols?: readonly string[] | undefined;
}

export interface MetricSnapshot {
  readonly counters: Record<string, number>;
  readonly gauges: Record<string, number>;
  readonly timers: Record<string, { count: number; totalMs: number; minMs: number; maxMs: number; avgMs: number }>;
}

export class PlatformMetricsCollector {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly timerSamples = new Map<string, number[]>();
  private readonly maxSamplesPerTimer: number;

  constructor(maxSamplesPerTimer: number = 500) {
    this.maxSamplesPerTimer = maxSamplesPerTimer;
  }

  public incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
  }

  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  public recordTimer(name: string, durationMs: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    let samples = this.timerSamples.get(key);
    if (!samples) {
      samples = [];
      this.timerSamples.set(key, samples);
    }
    samples.push(durationMs);
    if (samples.length > this.maxSamplesPerTimer) {
      samples.shift();
    }
  }

  public getSnapshot(): MetricSnapshot {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters.entries()) {
      counters[k] = v;
    }

    const gauges: Record<string, number> = {};
    for (const [k, v] of this.gauges.entries()) {
      gauges[k] = v;
    }

    const timers: Record<string, { count: number; totalMs: number; minMs: number; maxMs: number; avgMs: number }> = {};
    for (const [k, samples] of this.timerSamples.entries()) {
      if (samples.length === 0) {
        timers[k] = { count: 0, totalMs: 0, minMs: 0, maxMs: 0, avgMs: 0 };
      } else {
        const count = samples.length;
        const totalMs = samples.reduce((a, b) => a + b, 0);
        const minMs = Math.min(...samples);
        const maxMs = Math.max(...samples);
        const avgMs = Math.round(totalMs / count);
        timers[k] = { count, totalMs, minMs, maxMs, avgMs };
      }
    }

    return { counters, gauges, timers };
  }

  public reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.timerSamples.clear();
  }

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    // Sort label keys deterministically and sanitize to prevent high-cardinality leaks
    const entries = Object.entries(labels)
      .filter(([k]) => !k.toLowerCase().includes('prompt') && !k.toLowerCase().includes('path') && !k.toLowerCase().includes('query'))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v.substring(0, 32)}"`);
    return `${name}{${entries.join(',')}}`;
  }
}
