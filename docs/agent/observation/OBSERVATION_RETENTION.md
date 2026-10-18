# Observation Retention & Knowledge Policy

## 1. Overview

Observations vary in longevity and relevance. A low-level linter pass or ephemeral terminal command output is irrelevant once a task completes, whereas architectural schema changes, dependency additions, and verification records are enduring project knowledge.

---

## 2. Retention Categories

| Category | Retention Duration | Eviction Policy | Target Observation Types |
| :--- | :--- | :--- | :--- |
| **`EPHEMERAL`** | Task Active Lifecycle | Discarded upon task completion or context reset. | Command outputs, typecheck passes, lint runs, temporary diagnostics. |
| **`TASK_SCOPED`** | Task Lifetime + 7 Days | Retained for post-task audit, review, and timeline querying. | File modifications, test summaries, build results, blockers. |
| **`SESSION_SCOPED`** | Agent Session Lifetime | Retained while agent session remains active. | Agent reasoning decisions, context invalidation requests. |
| **`PERMANENT`** | Indefinite / Global | Persisted permanently into the project repository intelligence. | Structural API modifications, schema changes, dependencies, verification passes. |

---

## 3. Observation Knowledge Policy Engine

The `DEFAULT_OBSERVATION_KNOWLEDGE_POLICY` establishes mapping rules:

```typescript
export interface ObservationTypeRule {
  readonly defaultRetention: ObservationRetentionCategory;
  readonly isProjectRelevant: boolean;
  readonly triggersContextInvalidation: boolean;
  readonly priority: number;
}
```

### Knowledge Promotion Rules
- File modifications and symbol changes automatically tag affected features for context invalidation.
- Dependency, configuration, and API modifications trigger notifications to the Feature Knowledge layer.
- Observations categorized under `PERMANENT` are retained across session resets and indexed for future task context formulation.
