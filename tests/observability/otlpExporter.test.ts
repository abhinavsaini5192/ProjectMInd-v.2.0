import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OtlpHttpTraceExporter } from '../../src/observability/tracing/exporters/OtlpHttpTraceExporter.js';
import type { SpanData } from '../../src/observability/tracing/TraceTypes.js';

describe('OTLP HTTP Trace Exporter & Failure Isolation Suite', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const createDummySpan = (id: string): SpanData => ({
    traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    spanId: id.padStart(16, '0'),
    name: 'test_span_' + id,
    kind: 'INTERNAL',
    startTimeMs: 1000,
    endTimeMs: 1050,
    attributes: { 'test.key': 'val_' + id },
    durationMs: 50,
    sampled: true,
    events: [],
    status: 'OK',
  });

  it('formats spans into standard OTLP JSON resourceSpans structure', async () => {
    let capturedBody: string | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedBody = init?.body as string;
      return { ok: true, status: 200 } as Response;
    });

    const exporter = new OtlpHttpTraceExporter({
      endpoint: 'http://collector.local:4318/v1/traces',
      serviceName: 'test-mind',
      serviceVersion: '2.0.0',
    });

    const span = createDummySpan('1');
    await exporter.export([span]);

    expect(capturedBody).toBeDefined();
    const parsed = JSON.parse(capturedBody!);

    expect(parsed.resourceSpans).toBeDefined();
    expect(parsed.resourceSpans[0].resource.attributes).toEqual(
      expect.arrayContaining([
        { key: 'service.name', value: { stringValue: 'test-mind' } },
        { key: 'service.version', value: { stringValue: '2.0.0' } },
      ])
    );
    expect(parsed.resourceSpans[0].scopeSpans[0].spans[0].name).toBe('test_span_1');
    expect(exporter.getStats().exported).toBe(1);
    expect(exporter.getStats().failed).toBe(0);
  });

  it('isolates network and HTTP exporter failures without throwing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const exporter = new OtlpHttpTraceExporter({
      endpoint: 'http://unreachable.collector:4318/v1/traces',
    });

    // Must NOT throw: telemetry exporter failures must be isolated from business logic
    await expect(exporter.export([createDummySpan('err_1')])).resolves.not.toThrow();

    const stats = exporter.getStats();
    expect(stats.failed).toBe(1);
    expect(stats.exported).toBe(0);
  });

  it('drops oldest spans when maxQueueSize is exceeded to prevent OOM', async () => {
    // Mock fetch that hangs or fails to allow queue to build up
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Collector Down'));

    const maxQueue = 5;
    const exporter = new OtlpHttpTraceExporter({
      maxQueueSize: maxQueue,
    });

    const spans = Array.from({ length: 10 }, (_, i) => createDummySpan(String(i)));
    await exporter.export(spans);

    const stats = exporter.getStats();
    // 5 spans were dropped due to capacity overflow
    expect(stats.dropped).toBe(5);
    expect(stats.failed).toBeGreaterThanOrEqual(1);
  });

  it('handles graceful shutdown within deadline without hanging', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const exporter = new OtlpHttpTraceExporter();
    await exporter.shutdown(500);

    // Any subsequent export calls are ignored
    await exporter.export([createDummySpan('after_shutdown')]);
    expect(exporter.getStats().queued).toBe(0);
  });
});
