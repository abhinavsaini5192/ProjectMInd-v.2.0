# Execution Observation Data Model

## 1. Overview

The observation data model defines strongly-typed schemas for capturing external runtime events without allowing unverified data to mutate ProjectMind's authoritative knowledge base directly.

---

## 2. Core Entities

### 2.1. `ExecutionObservation`
The central immutable unit of observation:

```typescript
export interface ExecutionObservation {
  readonly observationId: string;
  readonly taskId?: string | undefined;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly source: ObservationSource;
  readonly type: ObservationType;
  readonly status: ObservationStatus;
  readonly timestamp: string;
  readonly payload: ObservationPayload;
  readonly confidence: ObservationConfidence;
  readonly provenance: ObservationProvenance | string;
  readonly orderingStatus: ObservationOrderingStatus;
  readonly retention: ObservationRetentionCategory;
  readonly correlationId?: string | undefined;
  readonly operationId?: string | undefined;
  readonly metadata: Record<string, unknown>;

  // Extended observation properties & convenient accessors
  readonly summary?: string | undefined;
  readonly category?: string | undefined;
  readonly ordering?: ObservationOrderingStatus | undefined;
  readonly observedAt?: string | undefined;
  readonly sequenceNumber?: number | undefined;
  readonly affectedResources?: readonly string[] | undefined;
  readonly parentObservationId?: string | undefined;
  readonly targetTaskState?: string | undefined;
}
```

---

## 3. Observation Types & Categories

Each observation type maps deterministically to a canonical category via `ObservationClassifier`:

| Category | Observation Types | Default Retention |
| :--- | :--- | :--- |
| **TASK** | `TASK_STARTED`, `TASK_PROGRESS`, `TASK_BLOCKED`, `TASK_COMPLETED`, `TASK_FAILED`, `BLOCKER_ENCOUNTERED` | `TASK_SCOPED` / `SESSION_SCOPED` |
| **FILE** | `FILE_CREATED`, `FILE_MODIFIED`, `FILE_DELETED`, `FILE_RENAMED`, `FILE_MOVED`, `FILE_MODIFICATION` | `TASK_SCOPED` |
| **SYMBOL** | `SYMBOL_CREATED`, `SYMBOL_MODIFIED`, `SYMBOL_DELETED`, `SYMBOL_RENAMED` | `TASK_SCOPED` |
| **ARCHITECTURE** | `DEPENDENCY_CHANGED`, `CONFIGURATION_CHANGED`, `API_CHANGED`, `DATA_SCHEMA_CHANGED` | `PERMANENT` |
| **COMMAND** | `COMMAND_STARTED`, `COMMAND_COMPLETED`, `COMMAND_FAILED`, `COMMAND_EXECUTION` | `EPHEMERAL` |
| **BUILD** | `BUILD_STARTED`, `BUILD_COMPLETED`, `BUILD_FAILED`, `BUILD_RESULT` | `TASK_SCOPED` |
| **TEST** | `TEST_STARTED`, `TEST_COMPLETED`, `TEST_FAILED`, `TEST_RESULT` | `TASK_SCOPED` |
| **LINT** | `LINT_STARTED`, `LINT_COMPLETED`, `LINT_FAILED`, `LINT_RESULT` | `EPHEMERAL` |
| **TYPECHECK** | `TYPECHECK_STARTED`, `TYPECHECK_COMPLETED`, `TYPECHECK_FAILED`, `TYPECHECK_RESULT` | `EPHEMERAL` |
| **DIAGNOSTICS** | `ERROR_REPORTED`, `WARNING_REPORTED`, `DIAGNOSTICS_REPORTED` | `TASK_SCOPED` |
| **CONTEXT** | `CONTEXT_REQUESTED`, `CONTEXT_REFRESHED`, `CONTEXT_INVALIDATED`, `CONTEXT_ACQUIRED` | `SESSION_SCOPED` |
| **VERIFICATION** | `VERIFICATION_STARTED`, `VERIFICATION_COMPLETED`, `VERIFICATION_FAILED`, `VERIFICATION_PASSED`, `VERIFICATION_RESULT` | `PERMANENT` |
| **AGENT** | `AGENT_DECISION`, `AGENT_BLOCKER` | `SESSION_SCOPED` |

---

## 4. Specialized Payloads

The system defines dedicated typed payload schemas for distinct observation domains:

1. **`CommandObservationPayload`**:
   `command`, `exitCode`, `executionDurationMs`, `workingDirectory`, `environmentVariables` (sanitized).
2. **`BuildObservationPayload`**:
   `success`, `durationMs`, `errorsCount`, `warningsCount`, `target`.
3. **`TestObservationPayload`**:
   `totalTests`, `passed`, `failed`, `skipped`, `durationMs`, `testSuite`, `failures`.
4. **`BlockerObservationPayload`**:
   `blockerType`, `description`, `suggestedRemediation`, `blockedAt`.
5. **`AgentDecisionObservationPayload`**:
   `decision`, `reason`, `alternativesConsidered`, `affectedSymbols`.
6. **`ResourceObservationPayload`**:
   `path`, `changeType`, `resourceType`, `diffSummary`.
