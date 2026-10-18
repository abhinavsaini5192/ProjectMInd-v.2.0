import type { ITraceExporter, SpanData } from '../TraceTypes.js';

export interface OtlpHttpTraceExporterOptions {
  readonly endpoint?: string | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly serviceName?: string | undefined;
  readonly serviceVersion?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxQueueSize?: number | undefined;
}

export class OtlpHttpTraceExporter implements ITraceExporter {
  public readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly serviceName: string;
  private readonly serviceVersion: string;
  private readonly timeoutMs: number;
  private readonly maxQueueSize: number;
  private readonly queue: SpanData[] = [];
  private isShutdown = false;
  private failedExportsCount = 0;
  private exportedSpansCount = 0;
  private droppedSpansCount = 0;

  constructor(options: OtlpHttpTraceExporterOptions = {}) {
    this.endpoint =
      options.endpoint ??
      process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'] ??
      'http://localhost:4318/v1/traces';
    this.headers = {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    };
    this.serviceName = options.serviceName ?? 'projectmind';
    this.serviceVersion = options.serviceVersion ?? '1.0.0';
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.maxQueueSize = options.maxQueueSize ?? 2000;
  }

  public async export(spans: readonly SpanData[]): Promise<void> {
    if (this.isShutdown) return;

    for (const span of spans) {
      if (this.queue.length >= this.maxQueueSize) {
        this.queue.shift(); // Drop oldest on queue overflow
        this.droppedSpansCount++;
      }
      this.queue.push(span);
    }

    // Attempt flush
    await this.flushQueue();
  }

  public async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.queue.length);
    const payload = this.formatOtlpPayload(batch);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.exportedSpansCount += batch.length;
      } else {
        this.failedExportsCount++;
      }
    } catch {
      // Telemetry failure isolation: exporter failure must NEVER crash host execution
      this.failedExportsCount++;
    }
  }

  public getStats(): {
    queued: number;
    exported: number;
    failed: number;
    dropped: number;
  } {
    return {
      queued: this.queue.length,
      exported: this.exportedSpansCount,
      failed: this.failedExportsCount,
      dropped: this.droppedSpansCount,
    };
  }

  public async shutdown(deadlineMs: number = 2000): Promise<void> {
    this.isShutdown = true;
    try {
      const flushPromise = this.flushQueue();
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, deadlineMs));
      await Promise.race([flushPromise, timeoutPromise]);
    } catch {
      // Ignored during shutdown
    }
  }

  private formatOtlpPayload(spans: readonly SpanData[]): Record<string, unknown> {
    const otlpSpans = spans.map((s) => ({
      traceId: s.traceId,
      spanId: s.spanId,
      parentSpanId: s.parentSpanId || undefined,
      name: s.name,
      kind: this.mapSpanKind(s.kind),
      startTimeUnixNano: String(s.startTimeMs * 1_000_000),
      endTimeUnixNano: String(s.endTimeMs * 1_000_000),
      attributes: Object.entries(s.attributes).map(([key, value]) => ({
        key,
        value: this.mapAttributeValue(value),
      })),
      events: s.events.map((e) => ({
        name: e.name,
        timeUnixNano: String(new Date(e.timestamp).getTime() * 1_000_000),
        attributes: e.attributes
          ? Object.entries(e.attributes).map(([k, v]) => ({
              key: k,
              value: this.mapAttributeValue(v),
            }))
          : [],
      })),
      status: {
        code: s.status === 'OK' ? 1 : s.status === 'ERROR' ? 2 : 0,
        message: s.statusDescription,
      },
    }));

    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this.serviceName } },
              { key: 'service.version', value: { stringValue: this.serviceVersion } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'projectmind-tracer', version: '1.0.0' },
              spans: otlpSpans,
            },
          ],
        },
      ],
    };
  }

  private mapSpanKind(kind: string): number {
    switch (kind) {
      case 'INTERNAL':
        return 1;
      case 'SERVER':
        return 2;
      case 'CLIENT':
        return 3;
      case 'PRODUCER':
        return 4;
      case 'CONSUMER':
        return 5;
      default:
        return 1;
    }
  }

  private mapAttributeValue(val: string | number | boolean): Record<string, unknown> {
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') {
      return Number.isInteger(val) ? { intValue: String(val) } : { doubleValue: val };
    }
    if (typeof val === 'boolean') return { boolValue: val };
    return { stringValue: String(val) };
  }
}
