# Task Execution Reporting & Context Invalidation (Phase 7.5)

## 1. Overview

External agents report file modifications, resource additions, removals, and renames to ProjectMind via `projectmind_report_execution`. ProjectMind acts as the repository intelligence coordinator:
1. Normalizes change sets into canonical `AgentChangeSet` structures.
2. Deduplicates reports using client-supplied `operationId` idempotency keys.
3. Triggers context staleness evaluation in `AgentContextSessionManager`.
4. Returns an `invalidationDecision` (`STALE`, `FRESH`, `PARTIAL_REFRESH_REQUIRED`, or `FULL_REFRESH_REQUIRED`) to inform the agent if context re-fetching is necessary.

---

## 2. Invalidation Flow

```mermaid
sequenceDiagram
    actor Agent as External Agent
    participant Runtime as TaskRuntime
    participant Coord as TaskExecutionCoordinator
    participant CtxMgr as AgentContextSessionManager
    participant Inval as ContextInvalidator
    participant Store as ITaskStore

    Agent->>Runtime: projectmind_report_execution(modifiedFiles, operationId)
    Runtime->>Coord: reportExecution(params, scope)
    Coord->>Store: checkIdempotency(operationId)
    alt Already Processed
        Coord-->>Agent: Return existing report & state (Idempotent)
    end
    Coord->>Coord: normalizeChangeSet(modifiedFiles)
    Coord->>CtxMgr: reportExecution(changeSet)
    CtxMgr->>Inval: evaluate(activeContext, changeSet)
    Inval-->>CtxMgr: InvalidationEvaluationResult(PARTIAL_REFRESH_REQUIRED)
    CtxMgr->>CtxMgr: markContextStale()
    Coord->>Store: saveExecutionState(IN_PROGRESS)
    Coord->>Store: recordProcessedOperation(operationId)
    Coord-->>Agent: { acknowledged: true, invalidationDecision: 'PARTIAL_REFRESH_REQUIRED' }
```

---

## 3. Idempotency Contract

External agent network hiccups or retries could cause duplicate execution reports.
- Agents provide an optional `operationId` (UUID or unique string).
- ProjectMind tracks processed operations in `ITaskStore.recordProcessedOperation`.
- If an `operationId` is seen again, `TaskExecutionCoordinator` returns the previously acknowledged report immediately without re-processing changes or triggering redundant invalidation evaluations.
