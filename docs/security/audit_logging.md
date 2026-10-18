# Phase 8.2 Audit Logging & Security Telemetry

## 1. Overview

Enterprise environments require immutable, tamper-evident audit trails for security monitoring, compliance (SOC 2, ISO 27001), and forensics.

The `AuditLogger` component records every security-sensitive event across authentication, authorization decisions, tool executions, and security violations.

---

## 2. Audit Event Schema

Every audit event conforms to the `AuditEvent` interface:

```typescript
export interface AuditEvent {
  readonly eventId: string;           // Deterministic unique ID (e.g. audit_1727192300000_abc123)
  readonly eventType: AuditEventType; // Categorized event type
  readonly principalId?: string;      // Actor triggering the event
  readonly workspaceId?: string;      // Tenant context
  readonly repositoryId?: string;     // Repository context
  readonly sessionId?: string;        // Agent runtime session ID
  readonly taskId?: string;           // Agent task ID
  readonly resourceType?: ResourceType;// Target resource
  readonly resourceId?: string;        // Target resource ID
  readonly action?: string;           // Attempted action
  readonly result: 'SUCCESS' | 'FAILURE' | 'ALLOWED' | 'DENIED';
  readonly reason?: string;           // Explanation if denied or failed
  readonly timestamp: string;         // ISO 8601 timestamp
  readonly details?: Record<string, unknown>; // Sanitized metadata
}
```

---

## 3. Automated Secret Redaction

Audit logs must **never** store plaintext credentials, API keys, or database connection strings.

Before any audit record is persisted:
1. `LogRedactor.redactObject` runs recursively over `details`.
2. Any key containing `password`, `secret`, `apiKey`, `token`, `authorization` has its value replaced with `[REDACTED]`.
3. URIs containing credentials (`user:password@host`) are sanitized to `user:[REDACTED]@host`.

---

## 4. Querying & Forensics

The `AuditLogger.queryEvents` method supports filtering by:
- `principalId`: Trace all activities by a specific agent or user.
- `workspaceId`: Audit tenant-specific operations.
- `eventType`: Filter for `SECURITY_VIOLATION` or `AUTHORIZATION_DENIAL`.
- `startTime` and `endTime`: Bounded time windows for incident response.
- `limit`: Pagination and output control.

---

## 5. Security Events on the EventBus

In addition to persisting audit records, high-severity events are immediately broadcast to the system event bus:
- `SECURITY_EVENTS.SECURITY_VIOLATION_DETECTED`
- `SECURITY_EVENTS.AUTHORIZATION_DENIED`
- `SECURITY_EVENTS.AUTHENTICATION_FAILED`

This allows real-time alerting, rate limiting, and SIEM forwarding.
