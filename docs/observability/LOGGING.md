# Structured Logging Architecture (Phase 8.5)

ProjectMind establishes canonical structured logging across all subsystems. The logger conforms to `ILogger` while introducing the canonical `LogEvent` model and ambient correlation enrichment.

---

## 1. LogEvent Data Model

Every log event emitted in ProjectMind includes standard fields:

```typescript
export interface LogEvent {
  readonly eventId: string;              // Unique UUIDv4 for this specific log event
  readonly timestamp: string;            // ISO-8601 UTC timestamp
  readonly level: LogLevel;              // 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  readonly eventName?: string;           // Optional semantic event identifier
  readonly service: string;              // Target service name (default: 'projectmind')
  readonly component: string;            // Subsystem (e.g., 'api', 'context-orchestrator')
  readonly operation: string;            // Operation name (e.g., 'generate_context')
  readonly message: string;              // Sanitized description
  readonly requestId?: string;           // Ambient or explicit HTTP/API request ID
  readonly correlationId?: string;       // Ambient end-to-end correlation ID
  readonly traceId?: string;             // Distributed trace identifier
  readonly spanId?: string;              // Active trace span identifier
  readonly principalReference?: string;  // Subject/user reference (anonymized)
  readonly workspaceId?: string;         // Active workspace identifier
  readonly repositoryId?: string;        // Active repository identifier
  readonly sessionId?: string;           // Agent runtime session ID
  readonly taskId?: string;              // Agent task identifier
  readonly durationMs?: number;          // Execution duration in milliseconds
  readonly outcome?: 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'UNKNOWN';
  readonly errorCode?: string;           // Standard error code if failed
  readonly metadata?: Record<string, unknown>; // Sanitized key-value metadata
}
```

---

## 2. Standardized Log Levels

| Level | Severity | Production Policy | Typical Events |
|---|---|---|---|
| `DEBUG` | Lowest | Disabled in production | Internal loop details, low-level cache lookups, token budget details. |
| `INFO` | Standard | Enabled | Service lifecycle events, successful context generations, task completions. |
| `WARN` | Elevated | Enabled | Recoverable anomalies, cache misses, retried knowledge updates, client 4xx errors. |
| `ERROR` | High | Enabled | Failed domain operations, database transaction failures, 5xx server errors. |
| `FATAL` | Critical | Enabled | Unrecoverable process failures, database corruptions, crash restarts. |

---

## 3. Centralized Log Sanitization

`LogSanitizer` enforces proactive redaction on all message strings, HTTP headers, and metadata objects before log entries reach any sink or console:

1. **Sensitive Key Redaction:**
   Any key in an object matching `password`, `token`, `secret`, `api_key`, `private_key`, `authorization`, `cookie`, `credentials` (or containing these substrings) has its value replaced with `"[REDACTED]"`.
2. **Regex Pattern Scrubber:**
   Detects and masks credentials embedded in freeform log messages:
   - `Bearer <token>` → `Bearer [REDACTED]`
   - `Basic <credentials>` → `Basic [REDACTED]`
   - OpenSSH / RSA / PEM private keys → `[REDACTED]`
   - Google API keys (`AIza...`) → `[REDACTED]`
   - OpenAI API keys (`sk-...`) → `[REDACTED]`
   - Key-value assignments like `password=xyz`, `secret: 'abc'` → `[REDACTED]`
3. **Payload Truncation:**
   Freeform text is automatically capped at `maxStringLength` (default: 4096 characters) to prevent memory bloating from large file or request body dumps.

---

## 4. Usage Example

```typescript
import { ObservabilityLogger, CorrelationContext } from './observability/index.js';

const logger = new ObservabilityLogger({ minLevel: 'INFO' });

// Ambient context is automatically captured:
CorrelationContext.run({
  requestId: 'req-123',
  correlationId: 'corr-456',
  workspaceId: 'ws-789'
}, () => {
  logger.info({
    component: 'context-orchestrator',
    operation: 'generate_context',
    message: 'Context generated successfully',
    durationMs: 85,
    details: { resourceCount: 4 }
  });
});
```
