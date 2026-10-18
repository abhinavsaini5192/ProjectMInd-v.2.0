import { describe, it, expect, beforeEach } from 'vitest';
import { Tracer, TraceSampler } from '../../src/observability/index.js';

describe('Observability - Distributed Tracing Subsystem', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer();
  });

  it('creates and ends spans with attributes and events', () => {
    const span = tracer.startSpan('context_generation', {
      attributes: { 'context.kind': 'feature_retrieval' },
    });

    span.setAttribute('context.resources', 5);
    span.addEvent('cache_checked', { hit: false });
    span.setStatus('OK');
    span.end();

    const completed = tracer.getCompletedSpans();
    expect(completed).toHaveLength(1);
    const data = completed[0]!;

    expect(data.name).toBe('context_generation');
    expect(data.status).toBe('OK');
    expect(data.attributes['context.kind']).toBe('feature_retrieval');
    expect(data.attributes['context.resources']).toBe(5);
    expect(data.events).toHaveLength(1);
    expect(data.events[0]!.name).toBe('cache_checked');
    expect(data.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records exceptions and updates status to ERROR', () => {
    const span = tracer.startSpan('failing_operation');
    span.recordException(new Error('Connection timeout to vector store'));
    span.end();

    const completed = tracer.getCompletedSpans();
    expect(completed).toHaveLength(1);
    const data = completed[0]!;
    expect(data.status).toBe('ERROR');
    expect(data.events).toHaveLength(1);
    expect(data.events[0]!.name).toBe('exception');
    expect(data.events[0]!.attributes?.['exception.message']).toBe('Connection timeout to vector store');
  });

  it('redacts sensitive values from span attributes and events', () => {
    const span = tracer.startSpan('auth_span');
    span.setAttribute('authorization_token', 'secret-token-xyz');
    span.setAttribute('safe_tag', 'safe-value');
    span.addEvent('token_validation', { token: 'Bearer sk-abcdef' });
    span.end();

    const completed = tracer.getCompletedSpans();
    const data = completed[0]!;
    expect(data.attributes['authorization_token']).toBe('[REDACTED]');
    expect(data.attributes['safe_tag']).toBe('safe-value');
    expect(data.events[0]!.attributes?.['token']).toBe('[REDACTED]');
  });

  it('propagates parent and trace contexts with withSpan', async () => {
    let childTraceId: string | undefined;
    let childParentId: string | undefined;

    await tracer.withSpan('parent_operation', async (parentSpan) => {
      parentSpan.setAttribute('layer', 'api');

      await tracer.withSpan('child_operation', (childSpan) => {
        childTraceId = childSpan.traceId;
        childParentId = childSpan.parentSpanId;
        childSpan.setAttribute('layer', 'storage');
      });
    });

    const completed = tracer.getCompletedSpans();
    expect(completed).toHaveLength(2);

    const child = completed.find((s) => s.name === 'child_operation')!;
    const parent = completed.find((s) => s.name === 'parent_operation')!;

    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
  });

  it('supports configurable sampling policy (NEVER drops spans from recording)', () => {
    const unsampledTracer = new Tracer({
      sampler: new TraceSampler('NEVER'),
    });

    const span = unsampledTracer.startSpan('dropped_span');
    expect(span.sampled).toBe(false);
    expect(span.isRecording()).toBe(false);
    span.end();

    expect(unsampledTracer.getCompletedSpans()).toHaveLength(0);
  });
});
