# Phase 7.8: Knowledge Update Loop

## Overview

The **Knowledge Update Loop** closes the feedback loop between external coding-agent activity and ProjectMind's persistent intelligence layer. When coding agents read, modify, and execute tasks across a software repository, ProjectMind ingests observation signals (Phase 7.6) and verification evidence (Phase 7.7) to incrementally, deterministically, and provenance-safely evolve its persistent knowledge graphs, feature intelligence, and session context.

```
External Coding Agent
        │
        ▼ (Tool Execution & FS Changes)
Execution Observation (Phase 7.6)
        │
        ▼ (Test & Build Signals)
Verification Evidence (Phase 7.7)
        │
        ▼
Knowledge Update Coordinator (Phase 7.8)
 ├── Normalizer & Deduplicator
 ├── Validator (Security & Path Bounds)
 ├── Impact Resolver (Targeted Feature Graphs)
 ├── Update Planner (Directed Dependency Stages)
 ├── Update Executor (Incremental Feature Engines)
 ├── Version Manager (Monotonic Versioning)
 ├── Invalidation Manager (Granular Cache Scoping)
 └── Refresh Manager (Session-Aware Context Staling)
```

## Fundamental Principle

$$\text{OBSERVATION} \longrightarrow \text{UPDATE PLAN} \longrightarrow \text{TARGETED KNOWLEDGE UPDATE} \longrightarrow \text{VERSION} \longrightarrow \text{INVALIDATION} \longrightarrow \text{CONTEXT REFRESH}$$

$$\mathbf{NOT:\quad \text{OBSERVATION} \longrightarrow \text{RESCAN ENTIRE REPOSITORY}}$$

ProjectMind maintains repository intelligence. It **never** triggers full repository rescans, AST re-parsing, or autonomous process execution (e.g. `child_process`, compilers, test runners) in response to targeted incremental updates.

## Documentation Guide Index

1. [Architecture & Components](./ARCHITECTURE.md): System design, component responsibilities, and DI container wiring.
2. [Lifecycle & State Transitions](./LIFECYCLE.md): Update lifecycle, state transitions (`RECEIVED` $\rightarrow$ `APPLIED`), and retry policies.
3. [Versioning & Monotonicity](./VERSIONING.md): Deterministic version progression (`K1` $\rightarrow$ `K2`), parent-child links, and version predicates.
4. [Provenance & Trust Hierarchy](./PROVENANCE.md): Trust levels, anti-forging guards, and precedence rules.
5. [Conflict Detection & Resolution](./CONFLICTS.md): Conflict identification, precedence resolution, and history persistence.
6. [Invalidation & Context Refresh](./INVALIDATION.md): Cache invalidation targets, session-aware stale marking, and lazy re-evaluations.
7. [Security & Isolation Bounds](./SECURITY.md): Directory traversal rejection, secret redaction, and multi-tenant isolation.
8. [Performance & Benchmarks](./PERFORMANCE.md): Deterministic latency guarantees ($O(1)$ and $O(k)$ fanout), batching, and resource conservation.

## Key Interfaces

- `IKnowledgeUpdateCoordinator`: Primary orchestrator for processing single and batch updates, observations, and verification records.
- `IKnowledgeUpdatePlanner`: Derives bounded operation sequences with explicit dependency ordering.
- `IKnowledgeImpactResolver`: Projects resource modifications to direct and downstream feature subgraphs.
- `IKnowledgeUpdateExecutor`: Dispatches targeted changes to feature intelligence engines.
- `IKnowledgeVersionManager`: Creates monotonic version records when canonical knowledge areas change.
- `IKnowledgeInvalidationManager`: Dispatches targeted invalidations across features and resources.
- `IKnowledgeRefreshManager`: Translates update impact into session stale-marking decisions.
