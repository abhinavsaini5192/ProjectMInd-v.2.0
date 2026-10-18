# Data Integrity Validation (Phase 8.4)

## Overview
ProjectMind employs programmatic integrity validation (`StorageIntegrityValidator`) to continuously detect corruption, orphan entities, broken foreign relationships, and scope violations without requiring manual SQL scripting.

---

## Validation Categories

### 1. Scope Validation (`checkEntityScope`)
Every workspace-scoped entity must declare a non-empty `workspaceId`. If an entity provides an empty or missing `workspaceId`, a `CRITICAL` severity `SCOPE_VIOLATION` issue is flagged immediately.

### 2. Foreign Reference Validation (`checkForeignReference`)
Verifies that child records do not reference deleted or non-existent parent records:
- Orphan `Task` records referencing non-existent `AgentSession`
- Orphan `KnowledgeUpdate` records referencing non-existent `Repository`
- Orphan `VerificationRecord` without an active `Task`

### 3. State Consistency Rules
Custom pluggable rules verify invariants such as:
- Knowledge version monotonicity (versions must strictly increase).
- Idempotency key uniqueness across pending knowledge updates.
- Checksum chain continuity on security audit events.

---

## Integrity Report Structure

```typescript
interface IntegrityReport {
  readonly isValid: boolean;
  readonly checkedAt: number;
  readonly durationMs: number;
  readonly totalChecked: number;
  readonly summary: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly issues: readonly IntegrityIssue[];
}
```

> [!CAUTION]
> The integrity validator **does not perform silent automatic repairs**. Data inconsistencies require explicit, auditable operational remediation to avoid compounding data corruption.
