import type {
  ISpan,
  ITracer,
  ITraceSampler,
  ITraceExporter,
  SpanData,
  SpanEvent,
  SpanKind,
  SpanStatus,
  StartSpanOptions,
  TraceSamplerPolicy,
} from './TraceTypes.js';
import { CorrelationContext } from '../correlation/CorrelationContext.js';
import { defaultLogSanitizer, LogSanitizer } from '../logging/LogSanitizer.js';
import { TraceContext } from './TraceContext.js';

export class TraceSampler implements ITraceSampler {
  public readonly policy: TraceSamplerPolicy;
  private readonly sampleRate: number;

  constructor(policy: TraceSamplerPolicy = 'ALWAYS', sampleRate: number = 1.0) {
    this.policy = policy;
    this.sampleRate = Math.max(0, Math.min(1, sampleRate));
  }

  public shouldSample(context: { traceId: string; name: string; kind?: SpanKind | undefined }): boolean {
    switch (this.policy) {
      case 'NEVER':
        return false;
      case 'ALWAYS':
        return true;
      case 'ERROR_ONLY':
        // Sampled if explicitly requested or dynamically on error
        return true;
      case 'PROBABILISTIC':
        return Math.random() < this.sampleRate;
      default:
        return true;
    }
  }
}

class SpanImpl implements ISpan {
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string | undefined;
  public readonly name: string;
  public readonly kind: SpanKind;
  public readonly startTimeMs: number;
  public readonly sampled: boolean;

  private _endTimeMs?: number | undefined;
  private _status: SpanStatus = 'UNSET';
  private _statusDescription?: string | undefined;
  private readonly _attributes = new Map<string, string | number | boolean>();
  private readonly _events: SpanEvent[] = [];
  private _isEnded = false;
  private readonly onEnd: (span: SpanImpl) => void;
  private readonly sanitizer: LogSanitizer;

  constructor(
    params: {
      traceId: string;
      spanId: string;
      parentSpanId?: string | undefined;
      name: string;
      kind: SpanKind;
      startTimeMs: number;
      sampled: boolean;
      initialAttributes?: Record<string, string | number | boolean> | undefined;
    },
    onEnd: (span: SpanImpl) => void,
    sanitizer: LogSanitizer
  ) {
    this.traceId = params.traceId;
    this.spanId = params.spanId;
    this.parentSpanId = params.parentSpanId;
    this.name = params.name;
    this.kind = params.kind;
    this.startTimeMs = params.startTimeMs;
    this.sampled = params.sampled;
    this.onEnd = onEnd;
    this.sanitizer = sanitizer;

    if (params.initialAttributes) {
      this.setAttributes(params.initialAttributes);
    }
  }

  public setAttribute(key: string, value: string | number | boolean): this {
    if (this._isEnded) return this;
    try {
      const sanitizedKey = key.toLowerCase();
      if (
        sanitizedKey.includes('password') ||
        sanitizedKey.includes('secret') ||
        sanitizedKey.includes('token') ||
        sanitizedKey.includes('key')
      ) {
        this._attributes.set(key, '[REDACTED]');
      } else if (typeof value === 'string') {
        this._attributes.set(key, this.sanitizer.sanitizeString(value));
      } else {
        this._attributes.set(key, value);
      }
    } catch {
      // Telemetry failure isolation
    }
    return this;
  }

  public setAttributes(attributes: Record<string, string | number | boolean>): this {
    for (const [k, v] of Object.entries(attributes)) {
      this.setAttribute(k, v);
    }
    return this;
  }

  public addEvent(name: string, attributes?: Record<string, string | number | boolean>): this {
    if (this._isEnded) return this;
    try {
      const cleanAttrs: Record<string, string | number | boolean> = {};
      if (attributes) {
        for (const [k, v] of Object.entries(attributes)) {
          if (typeof v === 'string') {
            cleanAttrs[k] = this.sanitizer.sanitizeString(v);
          } else {
            cleanAttrs[k] = v;
          }
        }
      }
      this._events.push({
        name: this.sanitizer.sanitizeString(name),
        timestamp: new Date().toISOString(),
        attributes: Object.keys(cleanAttrs).length > 0 ? cleanAttrs : undefined,
      });
    } catch {
      // Telemetry failure isolation
    }
    return this;
  }

  public setStatus(status: SpanStatus, description?: string): this {
    if (this._isEnded) return this;
    this._status = status;
    if (description) {
      this._statusDescription = this.sanitizer.sanitizeString(description);
    }
    return this;
  }

  public recordException(error: unknown): this {
    if (this._isEnded) return this;
    try {
      this.setStatus('ERROR');
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : 'Error';
      this.addEvent('exception', {
        'exception.type': name,
        'exception.message': this.sanitizer.sanitizeString(message),
      });
    } catch {
      // Telemetry failure isolation
    }
    return this;
  }

  public end(): void {
    if (this._isEnded) return;
    this._isEnded = true;
    this._endTimeMs = Date.now();
    if (this._status === 'UNSET') {
      this._status = 'OK';
    }
    try {
      this.onEnd(this);
    } catch {
      // Telemetry failure isolation
    }
  }

  public isRecording(): boolean {
    return !this._isEnded && this.sampled;
  }

  public toData(): SpanData | undefined {
    if (!this._isEnded) return undefined;
    const endTimeMs = this._endTimeMs ?? Date.now();
    const durationMs = Math.max(0, endTimeMs - this.startTimeMs);

    const attributes: Record<string, string | number | boolean> = {};
    for (const [k, v] of this._attributes.entries()) {
      attributes[k] = v;
    }

    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTimeMs: this.startTimeMs,
      endTimeMs,
      durationMs,
      status: this._status,
      statusDescription: this._statusDescription,
      attributes,
      events: [...this._events],
      sampled: this.sampled,
    };
  }
}

export interface TracerOptions {
  readonly sampler?: ITraceSampler | undefined;
  readonly exporter?: ITraceExporter | undefined;
  readonly sanitizer?: LogSanitizer | undefined;
  readonly maxCompletedSpans?: number | undefined;
}

export class Tracer implements ITracer {
  private readonly sampler: ITraceSampler;
  private readonly exporter?: ITraceExporter | undefined;
  private readonly sanitizer: LogSanitizer;
  private readonly maxCompletedSpans: number;
  private readonly completedSpans: SpanData[] = [];
  private activeSpan?: ISpan | undefined;

  constructor(options: TracerOptions = {}) {
    this.sampler = options.sampler ?? new TraceSampler('ALWAYS');
    this.exporter = options.exporter;
    this.sanitizer = options.sanitizer ?? defaultLogSanitizer;
    this.maxCompletedSpans = options.maxCompletedSpans ?? 500;
  }

  public startSpan(name: string, options: StartSpanOptions = {}): ISpan {
    const ambient = CorrelationContext.current();
    const traceId =
      options.traceId ??
      ambient?.traceId ??
      TraceContext.generateTraceId();
    const parentSpanId = options.parentSpanId ?? ambient?.spanId;
    const spanId = TraceContext.generateSpanId();
    const kind = options.kind ?? 'INTERNAL';

    const sampled =
      options.forceSampled !== undefined
        ? options.forceSampled
        : this.sampler.shouldSample({ traceId, name, kind });

    const span = new SpanImpl(
      {
        traceId,
        spanId,
        parentSpanId,
        name,
        kind,
        startTimeMs: Date.now(),
        sampled,
        initialAttributes: options.attributes,
      },
      (endedSpan) => {
        const data = endedSpan.toData();
        if (data && data.sampled) {
          this.completedSpans.push(data);
          if (this.completedSpans.length > this.maxCompletedSpans) {
            this.completedSpans.shift();
          }

          if (this.exporter) {
            this.exporter.export([data]).catch(() => {
              // Isolated exporter failure
            });
          }
        }
      },
      this.sanitizer
    );

    this.activeSpan = span;
    return span;
  }

  public async withSpan<T>(
    name: string,
    fn: (span: ISpan) => Promise<T> | T,
    options: StartSpanOptions = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);

    return CorrelationContext.run(
      CorrelationContext.createChildContext({
        traceId: span.traceId,
        spanId: span.spanId,
      }),
      async () => {
        try {
          const result = await fn(span);
          span.setStatus('OK');
          return result;
        } catch (error) {
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  public getActiveSpan(): ISpan | undefined {
    return this.activeSpan;
  }

  public getCompletedSpans(): readonly SpanData[] {
    return [...this.completedSpans];
  }

  public clearSpans(): void {
    this.completedSpans.length = 0;
    this.activeSpan = undefined;
  }

  public async flush(_deadlineMs?: number): Promise<void> {
    if (this.exporter && (this.exporter as any).flushQueue) {
      await (this.exporter as any).flushQueue();
    }
  }

  public async shutdown(deadlineMs?: number): Promise<void> {
    if (this.exporter) {
      await this.exporter.shutdown(deadlineMs);
    }
  }
}

export const defaultTracer = new Tracer();

