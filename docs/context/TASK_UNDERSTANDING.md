# Task Understanding & Intent Classification

## 1. Overview

Before context can be intelligently assembled, ProjectMind must understand what the developer or autonomous agent is trying to accomplish.

The [`TaskUnderstandingEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/task/TaskUnderstandingEngine.ts) transforms raw task descriptions into structured, canonical [`TaskUnderstanding`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/models/TaskUnderstanding.ts) objects.

## 2. Canonical Model

```typescript
export interface TaskUnderstanding {
  readonly taskId: string;
  readonly rawRequest: string;
  readonly normalizedRequest: string;
  readonly taskType: TaskType;
  readonly intent: TaskIntent;
  readonly targetEntities: string[];
  readonly candidateFeatures: string[];
  readonly candidateResources: string[];
  readonly requestedAction: string;
  readonly constraints: TaskConstraint[];
  readonly scope: TaskScope;
  readonly confidence: number;
  readonly provenance: string;
}
```

## 3. Taxonomy

### Task Types (`TaskType`)
- `IMPLEMENTATION`: New feature creation, adding endpoints, writing components.
- `BUG_FIX`: Resolving known defects, bugs, errors.
- `REFACTOR`: Restructuring code, cleaning architecture without changing behavior.
- `DEBUGGING`: Investigating runtime issues, timeouts, exceptions, stack traces.
- `EXPLANATION`: Explaining code behavior, API usage, architecture.
- `INVESTIGATION`: Root cause analysis, latency anomalies, why a failure occurred.
- `TESTING`: Writing unit/integration tests, increasing test coverage.
- `REVIEW`: Code review, security auditing, quality checks.
- `DOCUMENTATION`: Writing markdown docs, comments, API specs.
- `ARCHITECTURE`: System design, module boundaries, architectural blueprints.
- `PERFORMANCE`: Optimizing database queries, caching, reducing latency.
- `SECURITY`: Vulnerability remediation, authentication hardening.
- `MIGRATION`: Upgrading frameworks, schema migrations, dependency transitions.
- `UNKNOWN`: Unclassified / ambiguous tasks (never over-classified).

### Task Intents (`TaskIntent`)
`ADD` | `MODIFY` | `REMOVE` | `DEBUG` | `UNDERSTAND` | `EXPLAIN` | `REVIEW` | `TEST` | `OPTIMIZE` | `MIGRATE` | `INVESTIGATE` | `DESIGN` | `TRACE` | `COMPARE` | `UNKNOWN`

## 4. Constraint Extraction & Bounding

Constraints guide context selection to prevent irrelevant expansions:
- **`EXPLICIT_CONSTRAINT`**: Extracted directly from user instructions (e.g. *"Do not change the database schema"*). Confidence: $\ge 0.90$.
- **`INFERRED_CONSTRAINT`**: Derived from task heuristics or SLM suggestions. In accordance with safety rules, inferred constraints are **strictly capped at $0.70$ confidence**.
