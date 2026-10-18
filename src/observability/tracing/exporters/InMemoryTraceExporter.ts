import type { ITraceExporter, SpanData } from '../TraceTypes.js';

export class InMemoryTraceExporter implements ITraceExporter {
  private readonly buffer: SpanData[] = [];
  private readonly maxBufferSize: number;

  constructor(maxBufferSize: number = 1000) {
    this.maxBufferSize = maxBufferSize;
  }

  public async export(spans: readonly SpanData[]): Promise<void> {
    for (const span of spans) {
      this.buffer.push(span);
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift();
      }
    }
  }

  public getSpans(): readonly SpanData[] {
    return [...this.buffer];
  }

  public clear(): void {
    this.buffer.length = 0;
  }

  public async shutdown(): Promise<void> {
    // No-op for in-memory buffer
  }
}
