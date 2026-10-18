# Task Verification & Trust Boundaries (Phase 7.5)

## 1. Architectural Trust Boundary

ProjectMind **never** runs tests, spawns test runners, or evaluates code correctness autonomously. All testing, linting, and type checking is executed by the external agent in its environment.

To reflect this architectural reality:
- Verification records explicitly record `verificationSource: 'AGENT_REPORTED'`.
- ProjectMind acts as the ledger and validator of verification claims against the `TaskCompletionPolicy`.

---

## 2. Verification Aggregation & State Transition

When an agent reports verification results via `projectmind_report_verification`:

1. **State Transition**: If the task is currently in `IN_PROGRESS`, it transitions to `VERIFYING`.
2. **Result Ledger**: Aggregates test counts:
   - `testsPassed`
   - `testsFailed`
   - `testsSkipped`
   - `buildPassed`
   - `lintPassed`
   - `typeCheckPassed`
3. **Policy Check**: Determines whether all criteria of `TaskCompletionPolicy` are satisfied.
4. **Completion Readiness**: The response informs the agent (`canComplete: boolean`) whether the task is eligible for final completion.

```mermaid
graph LR
    Agent[External Agent Runs Tests Locally] -->|report_verification| TVC[Task Verification Coordinator]
    TVC -->|verificationSource: AGENT_REPORTED| VS[(ITaskStore.saveVerificationState)]
    TVC -->|Check Criteria| TCV[Task Completion Validator]
    TCV -->|Eligible?| Resp[Response: { acknowledged: true, canComplete: true }]
```
