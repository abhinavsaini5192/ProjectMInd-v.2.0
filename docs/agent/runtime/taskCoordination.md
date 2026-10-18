# Task Coordination & Completion Gating

## 1. Overview

The Task Coordinator manages agent tasks submitted to ProjectMind. Tasks transition through formal states:
`CREATED` $\to$ `ANALYZING` $\to$ `READY` $\to$ `IN_PROGRESS` $\to$ `VERIFYING` $\to$ `COMPLETED` / `FAILED` / `BLOCKED` / `CANCELLED`.

## 2. Multi-Gate Completion Validation

Before an external agent can mark a task `COMPLETED`, the runtime performs multi-gate validation via `TaskCompletionValidator`:
1. **Verification Gate**: Independent tests or build verification must have `PASSED`.
2. **Context Freshness Gate**: Relevant context sessions must not be stale.
3. **Execution Report Gate**: Modifications reported by the agent must have corresponding recorded observations.

If any gate fails, completion is rejected with `TaskCompletionValidationError`.
