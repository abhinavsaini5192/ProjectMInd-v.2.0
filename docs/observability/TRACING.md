# Distributed Tracing Architecture (Phase 8.5)

ProjectMind provides distributed tracing abstractions through `ITracer` and `ISpan`. Traces provide end-to-end timing breakdown across asynchronous boundaries without vendor coupling.

---

## 1. Trace Hierarchy & Flow

Traces propagate along the canonical execution pipeline:

```
  HTTP API Request Span (Kind: SERVER)
              │
              ├── Authentication & Authorization Span (Kind: INTERNAL)
              │
              └── Context Orchestration Span (Kind: INTERNAL)
                            │
                            ├── Knowledge Retrieval Span (Kind: INTERNAL)
                            │
                            └── Persistent Storage Query Span (Kind: CLIENT)
```

Ambient correlation is maintained using Node's `AsyncLocalStorage`, ensuring child spans automatically inherit parent `traceId` and `spanId` without manual plumbing across function signatures.

---

## 2. Span Lifecycle & Methods

Every span provides:

```typescript
export interface ISpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeMs: number;
  readonly sampled: boolean;

  setAttribute(key: string, value: string | number | boolean): this;
  setAttributes(attributes: Record<string, string | number | boolean>): this;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  setStatus(status: 'OK' | 'ERROR' | 'UNSET', description?: string): this;
  recordException(error: unknown): this;
  end(): void;
  isRecording(): boolean;
  toData(): SpanData | undefined;
}
```

---

## 3. Trace Sampling Strategies

The sampler evaluates each span before creation via `ITraceSampler`:

- `ALWAYS`: 100% of spans are sampled and recorded (development & testing default).
- `NEVER`: Spans are not recorded in memory.
- `PROBABILISTIC`: Samples a configured percentage (e.g. 1% or 10%) based on uniform random sampling.
- `ERROR_ONLY`: Retains spans associated with operational failures or explicit exception recordings.

---

## 4. Usage Example

```typescript
import { defaultTracer } from './observability/index.js';

await defaultTracer.withSpan('api_context_generation', async (span) => {
  span.setAttribute('workspace.id', 'ws-42');

  try {
    // Nested child span automatically links parent traceId and spanId
    const result = await defaultTracer.withSpan('storage_read', async (childSpan) => {
      childSpan.setAttribute('db.table', 'features');
      return await db.readFeatures();
    });

    span.setStatus('OK');
    return result;
  } catch (err) {
    span.recordException(err);
    throw err;
  }
});
```
