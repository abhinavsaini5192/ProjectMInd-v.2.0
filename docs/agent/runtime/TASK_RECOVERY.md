# Task Recovery & Session Reconnect (Phase 7.5)

## 1. Overview

External agents may disconnect, experience client crashes, or exceed lease timers. The `TaskRecoveryManager` provides deterministic recovery primitives:
1. **`reconnectSession(taskId, newAgentSessionId, scope)`**: Transfers active task ownership and lease to a reconnected or replacement agent session within the same workspace/repository.
2. **`resumeBlockedTask(taskId, scope)`**: Resumes a task in `BLOCKED` status back to `IN_PROGRESS` after verifying blockers are cleared.
3. **`checkContextStaleness(taskId, scope)`**: Inspects whether file modifications occurred while disconnected, indicating whether a context refresh is recommended.

---

## 2. Reconnection Protocol

```mermaid
sequenceDiagram
    actor Agent as Reconnected Agent Session
    participant TRM as TaskRecoveryManager
    participant TM as TaskManager
    participant TLM as TaskLifecycleManager
    participant Store as ITaskStore

    Agent->>TRM: reconnectSession(taskId, newSessionId, scope)
    TRM->>TRM: assertScope(task, scope)
    TRM->>Store: getLease(taskId)
    alt Lease Owned by Another Active Session
        TRM-->>Agent: throw TaskLeaseConflictError
    else Expired or Same Session
        TRM->>TM: acquireLease(taskId, newSessionId)
        TRM->>TLM: transition(IN_PROGRESS, actor: newSessionId)
        TRM->>Store: recordTimeline("Session reconnected")
        TRM-->>Agent: TaskRuntimeSnapshot (task, executionState, verificationState)
    end
```
