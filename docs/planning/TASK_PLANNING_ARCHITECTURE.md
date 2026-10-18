# Phase 9.6: Task Planning & Execution Orchestration Architecture

## 1. Executive Summary

Phase 9.6 establishes the canonical **Task Planning and Execution Orchestration Layer** for ProjectMind. Sitting above the existing **Task & Session Runtime** (Phase 4 / Phase 7), **Multi-Agent Collaboration Layer** (Phase 9.5), **Advanced Context Intelligence** (Phase 9.3), and **Semantic Retrieval & Project Memory** (Phase 9.4), this orchestration system transforms high-level coding objectives into structured, dependency-aware, and evidence-verified execution plans.

In strict alignment with the ProjectMind Core Architecture Principles:
- **Planning and execution are fundamentally separate responsibilities.**
- ProjectMind orchestrates *what* should happen, *why*, *what dependencies exist*, *which capabilities are required*, and *what verification gates must pass*.
- ProjectMind **never** directly writes arbitrary source code, executes shell commands, or spawns unrestricted agents. External AI coding agents execute tasks through the existing Agent Runtime.

---

## 2. Architectural Position & System Topology

```
                         User / Agent Objective Request
                                      │
                                      ▼
                           Task Understanding &
                         Decomposition Engine (9.6)
                                      │
                                      ▼
                        Canonical Task Plan (DAG)
                          ├── Task Nodes & Types
                          ├── Directed Dependencies
                          └── Verification Policies
                                      │
                                      ▼
                         Deterministic Validation &
                         Cycle Detection Resolver (9.6)
                                      │
                                      ▼
                         Task Readiness & Priority
                          Scoring Evaluator (9.6)
                                      │
                                      ▼
                       Task Assignment Engine (9.6)
                      (Integrates AgentRegistry 7.2)
                                      │
                                      ▼
                       Orchestration State Machine (9.6)
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
    External Coding Agent                             Multi-Agent Collaboration
   (Executes via Agent Runtime)                       (Resource Locks & Conflicts 9.5)
            │                                                   │
            └─────────────────────────┬─────────────────────────┘
                                      │
                                      ▼
                          Execution Observation &
                         Verification Reports (9.6)
                                      │
                                      ▼
                         Knowledge Update Loop (7.8)
                                      │
                                      ▼
                        Advance Plan & Next Tasks
```

---

## 3. Core Components

1. **Canonical Domain Model (`src/agent/planning/models/`)**:
   - `CanonicalTaskPlan`: Top-level graph model with workspace/project scope, revision, version, and nodes.
   - `TaskPlanNode`: Discrete unit of execution with status, priority, risk level, required capabilities, affected features/resources, context requirements, and verification policies.
   - `TaskType`: Controlled 19-type taxonomy (`ANALYSIS`, `RESEARCH`, `DESIGN`, `IMPLEMENTATION`, `DATABASE`, `TESTING`, `VERIFICATION`, etc.).
   - `TaskPlanStatus`: 12-state plan lifecycle with strict transition matrix (`LEGAL_PLAN_TRANSITIONS`).
   - `TaskNodeStatus`: 15-state node execution state (`PENDING`, `READY`, `BLOCKED`, `WAITING_FOR_DEPENDENCY`, `IN_PROGRESS`, `VERIFYING`, `COMPLETED`, `FAILED`, etc.).
   - `TaskDependencyType`: 9 graph edge types (`DEPENDS_ON`, `BLOCKS`, `REQUIRES`, `FOLLOWS`, `PARALLEL_WITH`, `VERIFIES`, `VALIDATES`, `PRODUCES`, `CONSUMES`).

2. **Decomposition Engine (`TaskDecomposer`)**:
   - Deconstructs natural-language objectives into ordered, typed DAGs based on repository patterns (Authentication, Database, Bugfix, Refactoring, General).
   - Treats LLM/user input as untrusted data, applying strict schema boundaries.

3. **Dependency & Cycle Resolver (`TaskDependencyResolver`)**:
   - Deterministic cycle detection using DFS with full path reconstruction.
   - Topological sorting via Kahn's algorithm.
   - Weighted critical-path analysis factoring in estimated task durations.
   - Parallel execution clustering enforcing disjoint resource boundaries (no concurrent mutations to the same files or symbols).

4. **Deterministic Readiness Evaluator (`TaskReadinessEvaluator`)**:
   - Mathematical prerequisite resolution: tasks transition to `READY` strictly when all dependencies are `COMPLETED` and approval gates are cleared.
   - Never delegates readiness logic to an LLM.

5. **Transparent Prioritization Engine (`TaskPrioritizer`)**:
   - Multi-factor scoring formula:
     $$\text{FinalScore} = \text{UserPriority} + \text{BlockingImpact} + \text{DependencyImpact} + \text{SecurityImpact} + \text{RiskImpact} + \text{ReadinessBoost}$$
   - Full explainability via `TaskPriorityExplanation` without exposing internal chain-of-thought.

6. **Agent Assignment Resolver (`TaskAssignmentResolver`)**:
   - Integrates with Phase 7 `AgentRegistry` to match task capabilities and roles against active, healthy agents.
   - Rejects inactive or draining agents and supports standalone fallback modes.

7. **Approval Gate Resolver (`ApprovalGateResolver`)**:
   - Human-in-the-loop and security policy gating for high-risk, database migration, and destructive operations.

8. **Atomic Checkpointing & Recovery (`TaskCheckpointManager`)**:
   - Snapshots entire execution graphs to support pause, resume, rollback, and restart resilience.

9. **Plan Revision & Replanning Manager (`TaskPlanRevisionManager`)**:
   - Versioned plan mutations triggered by verification failures or scope changes, generating diagnostic and remediation steps.

10. **Central Orchestrator (`TaskOrchestrator`)**:
    - Central coordinator driving the execution state machine, assigning agents, dispatching tasks, and observing verification reports.

---

## 4. Integration Matrix

| Integration Point | Interfacing Phase | System Interaction |
|---|---|---|
| **Agent Registry** | Phase 7.2 | Agent discovery, capability matching, and health tracking |
| **Task Runtime** | Phase 4 / Phase 7 | Discrete task lifecycle and observation reports |
| **Context Intelligence** | Phase 9.3 | Scoped context package retrieval for task nodes |
| **Project Memory** | Phase 9.4 | Historical decisions and architectural context |
| **Collaboration Engine** | Phase 9.5 | Resource reservation and parallel conflict detection |
| **Verification Loop** | Phase 7.7 | Test execution and verification evidence gating |
| **Knowledge Update Loop**| Phase 7.8 | Repository fact and feature updates post-execution |
| **CLI Platform** | Phase 9.1 | `projectmind plan` CLI command suite |
| **REST API** | Platform | `/plans` REST API controller endpoints |
