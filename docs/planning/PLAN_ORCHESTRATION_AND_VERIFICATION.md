# Plan Orchestration & Verification Gating

## 1. Orchestration Loop

The `TaskOrchestrator` coordinates plan advancement through an event-driven loop:

```
┌────────────────────────────────────────────────────────────────┐
│                   TaskOrchestrator.advancePlan                 │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
                 Evaluate Readiness of All Nodes
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
  Nodes with Unmet Dependencies                   All Dependencies Met
       Set status:                                 Set status:
  WAITING_FOR_DEPENDENCY                              READY
                                                        │
                                                        ▼
                                            Resolve Agent Assignment
                                            via AgentRegistry (7.2)
                                                        │
                                                        ▼
                                            Dispatch to External Agent
                                            (Agent Runtime Execution)
                                                        │
                                                        ▼
                                            Agent Reports Execution Result
                                                        │
                                ┌───────────────────────┴───────────────────────┐
                                ▼                                               ▼
                          Execution Success                               Execution Failure
                                │                                               │
                        Verification Policy?                            Retry budget remaining?
                      ┌─────────┴─────────┐                            ┌────────┴────────┐
                      ▼                   ▼                            ▼                 ▼
                     Yes                  No                          Yes                No
                  Transition:         Transition:                 Increment retry    Transition:
                  VERIFYING           COMPLETED                    & re-queue        FAILED
                      │
                      ▼
            Receive Verification Report
            (Unit tests / Build / Lint)
                      │
              ┌───────┴───────┐
              ▼               ▼
           Passed           Failed
         Transition:     Transition:
         COMPLETED         FAILED
```

---

## 2. Verification Gating

ProjectMind implements strict verification integrity:
- Tasks that modify code (`IMPLEMENTATION`, `DATABASE`, `REFACTOR`, `MIGRATION`) require an explicit `verificationPolicy` or a downstream `VERIFIES` node.
- An agent reporting `status: 'SUCCESS'` on an implementation node does **not** mark the task as complete if a verification policy is present. Instead, the node transitions to `VERIFYING`.
- Only an authenticated verification report with `passed: true` (e.g. from automated unit tests, build validation, or static analysis) permits the node to reach `COMPLETED` and unlock downstream tasks.
