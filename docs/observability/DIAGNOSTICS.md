# Runtime Diagnostics & Operational Snapshots (Phase 8.5)

The diagnostic subsystem tracks anomalous runtime conditions, provides operational remediation hints, and generates sanitized system snapshots for operators and AI agents without leaking secrets.

---

## 1. Diagnostic Categories & Severities

### Categories:
`CONFIGURATION`, `STORAGE`, `MIGRATION`, `SECURITY`, `API`, `CONTEXT`, `KNOWLEDGE`, `FEATURE`, `AGENT`, `VERIFICATION`, `PERFORMANCE`, `DEPENDENCY`, `RUNTIME`, `UNKNOWN`

### Severities:
- `INFO`: Normal status advisory (e.g. configuration loaded with defaults).
- `WARNING`: Suboptimal state (e.g. high context generation latency).
- `ERROR`: Component failure (e.g. vector index write error).
- `CRITICAL`: High-impact system failure (e.g. database disk saturation).

---

## 2. Diagnostic Model

```typescript
export interface Diagnostic {
  readonly diagnosticId: string;
  readonly category: DiagnosticCategory;
  readonly component: string;
  readonly severity: DiagnosticSeverity;
  readonly status: 'ACTIVE' | 'RESOLVED' | 'IGNORED';
  readonly message: string;
  readonly detectedAt: string;
  readonly correlationId?: string;
  readonly remediationHint?: string;
  readonly metadata?: Record<string, unknown>;
}
```

---

## 3. Operational Snapshot Structure

The `createSnapshot()` method produces a bounded, sanitized JSON structure:

```typescript
export interface DiagnosticSnapshot {
  readonly snapshotId: string;
  readonly generatedAt: string;
  readonly applicationVersion: string;
  readonly apiVersion: string;
  readonly environment: string;
  readonly runtimeState: {
    readonly nodeVersion: string;
    readonly platform: string;
    readonly uptimeSeconds: number;
    readonly memoryUsageMb: {
      readonly rss: number;
      readonly heapTotal: number;
      readonly heapUsed: number;
      readonly external: number;
    };
  };
  readonly activeDiagnostics: readonly Diagnostic[];
  readonly diagnosticCounts: {
    readonly total: number;
    readonly critical: number;
    readonly error: number;
    readonly warning: number;
    readonly info: number;
  };
  readonly telemetryState: {
    readonly loggingEnabled: boolean;
    readonly metricsEnabled: boolean;
    readonly tracingEnabled: boolean;
  };
}
```

### Safety Guarantee:
The snapshot generation process strictly scrubs any embedded authentication credentials, passwords, tokens, API keys, or raw code prompts from the snapshot metadata.

---

## 4. Usage Example

```typescript
import { defaultDiagnosticManager } from './observability/index.js';

// Record an operational diagnostic
const diag = defaultDiagnosticManager.recordDiagnostic({
  category: 'STORAGE',
  component: 'sqlite_store',
  severity: 'WARNING',
  message: 'WAL checkpoint duration exceeded 500ms',
  remediationHint: 'Consider running PRAGMA optimize or checking disk I/O load.',
  metadata: { checkpointDurationMs: 620 }
});

// Resolve after issue clears
defaultDiagnosticManager.resolveDiagnostic(diag.diagnosticId);
```
