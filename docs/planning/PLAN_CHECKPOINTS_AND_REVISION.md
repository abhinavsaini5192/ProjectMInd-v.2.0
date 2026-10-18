# Plan Checkpoints, Revisions, and Replanning

## 1. Plan Checkpointing

Long-running plans maintain snapshot resilience through [TaskCheckpointManager.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/agent/planning/services/TaskCheckpointManager.ts).
A checkpoint captures an atomic state snapshot of:
- Plan metadata, version, and revision number
- Node states, assignment records, and execution outputs
- Active, completed, and failed task partitions
- Checkpoint description and reason

### Recovery Workflow
1. The orchestrator or human operator invokes `restoreCheckpoint(checkpointId)`.
2. The plan's node graph and partition states are restored to the snapshot state.
3. The plan version is safely incremented, preserving auditability and recovery history.

---

## 2. Plan Revisions & Versioning

Plans track revisions independently of task versions and repository commits:
- **Plan Revision**: Increments whenever the DAG structure changes (nodes added, removed, or dependencies altered).
- **Plan Version**: Increments whenever node execution states or plan statuses transition.
- **Revision History**: Recorded in [TaskPlanRevision.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/agent/planning/models/TaskPlanRevision.ts) with explicit triggers (`TASK_FAILURE`, `VERIFICATION_FAILURE`, `REPOSITORY_CHANGE`, `MANUAL_REQUEST`), affected nodes, and rationale.

---

## 3. Policy-Driven Replanning

When a task fails or verification evidence rejects an implementation, `TaskPlanRevisionManager.replanAfterFailure` dynamically amends the plan:
1. An investigation/remediation node (`taskType: 'INVESTIGATION'`) is prepended before the failed step.
2. The failed step is re-queued as `PENDING`, set to depend on the remediation node.
3. Downstream tasks remain safely blocked until remediation and re-verification succeed.
