import type { ITraceExporter, SpanData } from '../TraceTypes.js';

export class NoopTraceExporter implements ITraceExporter {
  public async export(_spans: readonly SpanData[]): Promise<void> {
    // Intentionally no-op
  }

  public async shutdown(): Promise<void> {
    // Intentionally no-op
  }
}
