import { describe, it, expect } from 'vitest';
import { TraceContext } from '../../src/observability/tracing/TraceContext.js';

describe('W3C TraceContext & Correlation Identifier Suite', () => {
  it('parses valid W3C traceparent header correctly', () => {
    const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const parsed = TraceContext.parseTraceparent(header);

    expect(parsed).toBeDefined();
    expect(parsed?.version).toBe('00');
    expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(parsed?.spanId).toBe('00f067aa0ba902b7');
    expect(parsed?.sampled).toBe(true);
  });

  it('serializes trace context to valid W3C traceparent format', () => {
    const traceparent = TraceContext.toTraceparent(
      '4bf92f3577b34da6a3ce929d0e0e4736',
      '00f067aa0ba902b7',
      true
    );
    expect(traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');

    const unsampled = TraceContext.toTraceparent(
      '4bf92f3577b34da6a3ce929d0e0e4736',
      '00f067aa0ba902b7',
      false
    );
    expect(unsampled).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
  });

  it('rejects invalid traceparent versions and malformed strings', () => {
    // Version 'ff' is explicitly prohibited by W3C Trace Context spec
    expect(TraceContext.parseTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeUndefined();

    // Invalid delimiters / parts count
    expect(TraceContext.parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7')).toBeUndefined();
    expect(TraceContext.parseTraceparent('invalid-traceparent-header')).toBeUndefined();
    expect(TraceContext.parseTraceparent('')).toBeUndefined();

    // Non-hex characters
    expect(TraceContext.parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e47zz-00f067aa0ba902b7-01')).toBeUndefined();
  });

  it('rejects all-zero traceId and all-zero spanId per W3C spec', () => {
    const allZeroTrace = '00-00000000000000000000000000000000-00f067aa0ba902b7-01';
    expect(TraceContext.parseTraceparent(allZeroTrace)).toBeUndefined();

    const allZeroSpan = '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01';
    expect(TraceContext.parseTraceparent(allZeroSpan)).toBeUndefined();
  });

  it('generates compliant 32-hex trace IDs and 16-hex span IDs', () => {
    const traceId = TraceContext.generateTraceId();
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(traceId).not.toBe('00000000000000000000000000000000');

    const spanId = TraceContext.generateSpanId();
    expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(spanId).not.toBe('0000000000000000');
  });

  it('validates correlation IDs against injection attacks and bounds length', () => {
    // Valid correlation IDs
    expect(TraceContext.validateCorrelationId('corr-valid-123_456.xyz')).toBe('corr-valid-123_456.xyz');

    // Rejects header injection with CRLF
    expect(TraceContext.validateCorrelationId('corr-id\r\nX-Injected: true')).toBeUndefined();

    // Rejects empty / non-string
    expect(TraceContext.validateCorrelationId('')).toBeUndefined();
    expect(TraceContext.validateCorrelationId(undefined)).toBeUndefined();

    // Truncates / rejects excessively long IDs (> 128 characters)
    const longId = 'a'.repeat(200);
    const validated = TraceContext.validateCorrelationId(longId);
    expect(validated).toBeDefined();
    expect(validated?.length).toBeLessThanOrEqual(128);
  });
});
