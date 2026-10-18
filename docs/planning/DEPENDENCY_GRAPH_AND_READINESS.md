# Dependency Graph, Cycle Detection, and Task Readiness

## 1. Graph Relationships

Task dependencies connect nodes in a Directed Acyclic Graph (DAG) using types specified in [TaskDependencyType.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/agent/planning/models/TaskDependencyType.ts):

- `DEPENDS_ON`: Direct prerequisite; target must reach `COMPLETED` before source can be `READY`.
- `BLOCKS`: Inverse edge indicating that source prevents target from proceeding.
- `REQUIRES`: Mandatory capability or environment dependency.
- `FOLLOWS`: Soft ordering (e.g. documentation follows testing).
- `PARALLEL_WITH`: Explicit indication of concurrency compatibility.
- `VERIFIES`: Source node is a verification/test gate for target modification.
- `VALIDATES`: Schema or architecture validation edge.
- `PRODUCES`: Artifact generation association.
- `CONSUMES`: Artifact input requirement.

---

## 2. Deterministic Cycle Detection

Cycle detection in [TaskDependencyResolver.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/agent/planning/services/TaskDependencyResolver.ts) uses a Depth-First Search (DFS) algorithm with a three-color state mapping (0 = unvisited, 1 = visiting, 2 = visited):

- **Deterministic**: Detects self-referencing nodes ($A \to A$), two-node cycles ($A \to B \to A$), and complex multi-node cycles ($A \to B \to C \to A$).
- **Explainable**: Isolates the exact circular path (e.g. `['step_a', 'step_b', 'step_a']`) to render actionable validation error messages.
- **Fail-Fast**: Plans containing cycles are rejected immediately during validation and cannot enter execution.

---

## 3. Parallel Execution Planning with Conflict Isolation

ProjectMind groups concurrent tasks using resource conflict isolation:
- Two tasks are **only** scheduled in the same parallel execution tier if their `affectedResources` lists are completely disjoint.
- If Task A touches `src/auth/service.ts` and Task B also touches `src/auth/service.ts`, they are never placed in the same parallel tier, preventing concurrent git or workspace collisions.

---

## 4. Mathematical Readiness Evaluation

Task readiness is evaluated deterministically in [TaskReadinessEvaluator.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/agent/planning/services/TaskReadinessEvaluator.ts). A task becomes `READY` if and only if:
1. It is currently `PENDING` or `WAITING_FOR_DEPENDENCY`.
2. All target nodes in its `DEPENDS_ON` edges have `status === 'COMPLETED'`.
3. Its approval record has `status === 'APPROVED'` or `status === 'NOT_REQUIRED'`.
4. There are no active file reservation conflicts with currently running tasks.
