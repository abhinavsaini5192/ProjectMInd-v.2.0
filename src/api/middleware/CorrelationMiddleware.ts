import { randomUUID } from 'node:crypto';
import type { ApiMiddleware } from './ApiMiddleware.js';
import { CorrelationContext, type CorrelationData } from '../../observability/correlation/CorrelationContext.js';
import { TraceContext } from '../../observability/tracing/TraceContext.js';

export function createCorrelationMiddleware(): ApiMiddleware {
  return async (request, next) => {
    const rawCorrelationId =
      request.headers['x-correlation-id'] ||
      request.headers['x-correlation-id'] ||
      request.headers['correlation-id'];

    const correlationId =
      TraceContext.validateCorrelationId(rawCorrelationId) ?? randomUUID();

    const rawRequestId =
      request.headers['x-request-id'] ||
      request.headers['x-request-id'] ||
      request.headers['request-id'];

    const requestId =
      TraceContext.validateCorrelationId(rawRequestId) ?? randomUUID();

    // Parse incoming W3C traceparent header
    const rawTraceparent = request.headers['traceparent'];
    const parsedTrace = (typeof rawTraceparent === 'string'
      ? TraceContext.parseTraceparent(rawTraceparent)
      : undefined) ?? {
      traceId: TraceContext.generateTraceId(),
      spanId: undefined,
      parentSpanId: undefined,
      sampled: true,
      isValid: false,
    };

    const serverSpanId = TraceContext.generateSpanId();
    const traceparentHeader = TraceContext.formatTraceparent(
      parsedTrace.traceId,
      serverSpanId,
      parsedTrace.sampled
    );

    // Mutate request context in-place safely for down-chain handlers
    const ctx = request.context as unknown as {
      requestId: string;
      correlationId: string;
      traceId?: string;
      spanId?: string;
      [key: string]: unknown;
    };
    ctx.correlationId = correlationId;
    ctx.requestId = requestId;
    ctx.traceId = parsedTrace.traceId;
    ctx.spanId = serverSpanId;

    const correlationData: CorrelationData = {
      requestId,
      correlationId,
      causationId: parsedTrace.parentSpanId,
      traceId: parsedTrace.traceId,
      spanId: serverSpanId,
      principalId: request.context?.principal?.principalId,
    };

    // Run down-chain execution within AsyncLocalStorage ambient correlation context
    return CorrelationContext.run(correlationData, async () => {
      const response = await next();

      return {
        ...response,
        headers: {
          ...(response.headers ?? {}),
          'x-correlation-id': correlationId,
          'x-request-id': requestId,
          'traceparent': traceparentHeader,
        },
        meta: {
          ...response.meta,
          requestId,
          correlationId,
          traceId: parsedTrace.traceId,
          spanId: serverSpanId,
        },
      };
    });
  };
}

