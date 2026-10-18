export type SpanStatus = 'OK' | 'ERROR' | 'UNSET';
export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';

export interface SpanEvent {
  readonly name: string;
  readonly timestamp: string;
  readonly attributes?: Readonly<Record<string, string | number | boolean>> | undefined;
}

export interface SpanData {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string | undefined;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly status: SpanStatus;
  readonly statusDescription?: string | undefined;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
  readonly events: readonly SpanEvent[];
  readonly sampled: boolean;
}

export interface StartSpanOptions {
  readonly parentSpanId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly kind?: SpanKind | undefined;
  readonly attributes?: Record<string, string | number | boolean> | undefined;
  readonly forceSampled?: boolean | undefined;
}

export interface ISpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string | undefined;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeMs: number;
  readonly sampled: boolean;

  setAttribute(key: string, value: string | number | boolean): this;
  setAttributes(attributes: Record<string, string | number | boolean>): this;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  setStatus(status: SpanStatus, description?: string): this;
  recordException(error: unknown): this;
  end(): void;
  isRecording(): boolean;
  toData(): SpanData | undefined;
}

export type TraceSamplerPolicy = 'ALWAYS' | 'NEVER' | 'PROBABILISTIC' | 'ERROR_ONLY';

export interface ITraceSampler {
  readonly policy: TraceSamplerPolicy;
  shouldSample(context: { traceId: string; name: string; kind?: SpanKind | undefined }): boolean;
}

export interface ITraceExporter {
  export(spans: readonly SpanData[]): Promise<void>;
  shutdown(deadlineMs?: number): Promise<void>;
}

export interface ITracer {
  startSpan(name: string, options?: StartSpanOptions): ISpan;
  withSpan<T>(name: string, fn: (span: ISpan) => Promise<T> | T, options?: StartSpanOptions): Promise<T>;
  getActiveSpan(): ISpan | undefined;
  getCompletedSpans(): readonly SpanData[];
  clearSpans(): void;
  flush(deadlineMs?: number): Promise<void>;
  shutdown(deadlineMs?: number): Promise<void>;
}

export const ITracerToken = Symbol('ITracer');

