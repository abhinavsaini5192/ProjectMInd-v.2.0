import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { TraceContext } from '../tracing/TraceContext.js';

export interface CorrelationData {
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId?: string | undefined;
  readonly eventId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly spanId?: string | undefined;
  readonly instanceId?: string | undefined;
  readonly role?: string | undefined;
  readonly jobId?: string | undefined;
  readonly attemptNumber?: number | undefined;
  readonly aggregateId?: string | undefined;
  readonly organizationId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly principalId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly attributes?: Readonly<Record<string, string>> | undefined;
}

export class CorrelationContext {
  private static readonly storage = new AsyncLocalStorage<CorrelationData>();

  public static run<T>(context: CorrelationData, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  public static current(): CorrelationData | undefined {
    return this.storage.getStore();
  }

  public static getCorrelationId(): string {
    return this.current()?.correlationId ?? 'corr-ambient-none';
  }

  public static getCausationId(): string | undefined {
    return this.current()?.causationId;
  }

  public static getRequestId(): string {
    return this.current()?.requestId ?? 'req-ambient-none';
  }

  public static getTraceId(): string | undefined {
    return this.current()?.traceId;
  }

  public static getSpanId(): string | undefined {
    return this.current()?.spanId;
  }

  public static createChildContext(overrides: Partial<CorrelationData> = {}): CorrelationData {
    const parent = this.current();
    const correlationId =
      overrides.correlationId ??
      parent?.correlationId ??
      randomUUID();
    const requestId = overrides.requestId ?? parent?.requestId ?? randomUUID();
    const traceId = overrides.traceId ?? parent?.traceId ?? TraceContext.generateTraceId();

    return {
      requestId,
      correlationId,
      causationId: overrides.causationId ?? parent?.causationId ?? parent?.correlationId,
      eventId: overrides.eventId ?? parent?.eventId,
      traceId,
      spanId: overrides.spanId ?? TraceContext.generateSpanId(),
      instanceId: overrides.instanceId ?? parent?.instanceId,
      role: overrides.role ?? parent?.role,
      jobId: overrides.jobId ?? parent?.jobId,
      attemptNumber: overrides.attemptNumber ?? parent?.attemptNumber,
      aggregateId: overrides.aggregateId ?? parent?.aggregateId,
      organizationId: overrides.organizationId ?? parent?.organizationId,
      workspaceId: overrides.workspaceId ?? parent?.workspaceId,
      repositoryId: overrides.repositoryId ?? parent?.repositoryId,
      principalId: overrides.principalId ?? parent?.principalId,
      sessionId: overrides.sessionId ?? parent?.sessionId,
      taskId: overrides.taskId ?? parent?.taskId,
      attributes: {
        ...(parent?.attributes ?? {}),
        ...(overrides.attributes ?? {}),
      },
    };
  }

  public static createRootContext(initial: Partial<CorrelationData> = {}): CorrelationData {
    const correlationId =
      TraceContext.validateCorrelationId(initial.correlationId) ??
      initial.correlationId ??
      randomUUID();
    const requestId =
      TraceContext.validateCorrelationId(initial.requestId) ??
      initial.requestId ??
      randomUUID();
    const traceId = initial.traceId ?? TraceContext.generateTraceId();

    return {
      requestId,
      correlationId,
      causationId: initial.causationId,
      eventId: initial.eventId,
      traceId,
      spanId: initial.spanId ?? TraceContext.generateSpanId(),
      instanceId: initial.instanceId,
      role: initial.role,
      jobId: initial.jobId,
      attemptNumber: initial.attemptNumber,
      aggregateId: initial.aggregateId,
      organizationId: initial.organizationId,
      workspaceId: initial.workspaceId,
      repositoryId: initial.repositoryId,
      principalId: initial.principalId,
      sessionId: initial.sessionId,
      taskId: initial.taskId,
      attributes: initial.attributes ?? {},
    };
  }
}
