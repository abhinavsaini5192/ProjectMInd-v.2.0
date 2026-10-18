# Task Lifecycle Management (Phase 7.5)

## 1. Overview

The Task Lifecycle Manager (`ITaskLifecycleManager`) coordinates transitions, status validation, event broadcasting, and audit trail generation for all `AgentTask` entities in ProjectMind.

---

## 2. Canonical Task States

```
[CREATED] ──> [ANALYZING] ──> [READY] ──> [IN_PROGRESS] ──> [VERIFYING] ──> [COMPLETED]
    │              │             │              │                │
    v              v             v              v                v
 [CANCELLED]   [CANCELLED]   [CANCELLED]    [BLOCKED]        [BLOCKED]
    │              │             │              │                │
    v              v             v              v                v
 [FAILED]       [FAILED]      [FAILED]      [FAILED]         [FAILED]
```

### State Definitions

1. **`CREATED`**: Initial entry state. Task metadata, title, intent, and workspace scopes are registered. Task lease is acquired.
2. **`ANALYZING`**: The repository intelligence engine and Context Session Manager are analyzing feature dependencies, impacted files, and historical change patterns.
3. **`READY`**: Initial context package and token budget allocations are finalized. The task is fully primed for agent consumption.
4. **`IN_PROGRESS`**: The external agent is actively editing code, generating patches, or executing local commands.
5. **`BLOCKED`**: Execution cannot proceed due to external blockers (e.g., missing dependencies, ambiguity, failed assumptions, or merge conflicts).
6. **`VERIFYING`**: The external agent has completed implementation changes and is executing tests, lint checks, type checks, and build validations in its environment.
7. **`COMPLETED`**: Terminal state. All changes are verified, tests passed, build succeeded, and the completion policy criteria are satisfied.
8. **`FAILED`**: Terminal state. Unrecoverable verification failure or execution crash.
9. **`CANCELLED`**: Terminal state. User or agent explicitly terminated the task.

---

## 3. Audit Timeline & Event Broadcasting

Every state transition records an entry in the persistent task timeline:
- **`timestamp`**: High-precision UTC timestamp.
- **`event`**: Description of state change (e.g. `Task state changed: READY -> IN_PROGRESS`).
- **`actor`**: Agent session ID triggering the transition.
- **`details`**: `{ previousState, newState, reason, version }`.

### Canonical EventBus Events

Whenever a state transition occurs, `TaskLifecycleManager` emits a canonical event:
- `agent.task.created`
- `agent.task.analyzing`
- `agent.task.ready`
- `agent.task.started`
- `agent.task.blocked`
- `agent.task.resumed`
- `agent.task.verification_started`
- `agent.task.completed`
- `agent.task.failed`
- `agent.task.cancelled`
