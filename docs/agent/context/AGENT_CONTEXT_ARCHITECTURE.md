# Agent Context Architecture

## 1. Executive Summary

Phase 7.4 of ProjectMind implements **Agent Context Integration**, bringing the Context Orchestrator directly into the agent session lifecycle. The core principle governing this subsystem is:

> **"Context follows the task."**
> External coding agents do not repeatedly rescan or explore the codebase. ProjectMind maintains a stateful, versioned, and freshened context relationship throughout the task lifecycle.

## 2. Fundamental Architectural Division of Responsibilities

ProjectMind maintains a strict boundary between repository intelligence and external coding agents:

| Subsystem | Responsibility | What it DOES NOT do |
| :--- | :--- | :--- |
| **ProjectMind** | • Understand repository state<br>• Map and resolve features<br>• Select relevant knowledge<br>• Construct token-budgeted context packages<br>• Track context freshness & staleness<br>• Analyze impact of reported changes<br>• Compute context deltas<br>• Perform smart partial refreshes | • Edit workspace files<br>• Execute arbitrary shell commands<br>• Run test suites directly<br>• Synthesize production code<br>• Act as an autonomous coding agent |
| **External Agent** (Claude, Cursor, CLI) | • Prompt reasoning & planning<br>• Code modification & authoring<br>• File editing & formatting<br>• Test execution & verification<br>• Reporting changes back to ProjectMind | • Compute global repository topology<br>• Rescan codebase repeatedly<br>• Calculate feature dependencies manually |

```mermaid
sequenceDiagram
    autonumber
    actor Agent as External Agent
    participant Runtime as Canonical Protocol / MCP
    participant Mgr as AgentContextSessionManager
    participant Orch as ContextOrchestrator
    participant Inv as AgentContextInvalidator
    participant Ref as AgentContextRefresher

    Agent->>Runtime: projectmind_start_task_context(taskText)
    Runtime->>Mgr: startTaskContext(params)
    Mgr->>Orch: orchestrateContext(initialRequest)
    Orch-->>Mgr: ContextPackage (v1)
    Mgr-->>Agent: { task, contextSession, contextPackage (v1) }

    Note over Agent: Agent works externally<br/>(edits files, runs tests)

    Agent->>Runtime: projectmind_report_execution(changedFiles)
    Runtime->>Mgr: reportExecution(report)
    Mgr->>Inv: evaluateInvalidation(changeSet)
    Inv-->>Mgr: PARTIAL_REFRESH_REQUIRED (stale: RESOURCES, BEHAVIOR)
    Mgr-->>Agent: { acknowledged: true, isStale: true }

    Agent->>Runtime: projectmind_get_current_context(includeDelta: true)
    Runtime->>Mgr: getCurrentContext(autoRefresh: true)
    Mgr->>Ref: refreshContext(staleSections, affectedFeatures)
    Ref-->>Mgr: ContextPackage (v2) [reused unaffected sections]
    Mgr-->>Agent: { contextPackage (v2), delta }
```

## 3. Core Components

1. **`AgentContextSessionManager`**: Coordinates session lifecycle, task transitions, optimistic concurrency version checks, and event emissions.
2. **`AgentContextInvalidator`**: Analyzes reported file changes against `IFeatureKnowledgeAPI.getFeatureImpact()` to identify affected features and mark only relevant sections as stale (`NO_REFRESH_REQUIRED`, `PARTIAL_REFRESH_REQUIRED`, `FULL_REFRESH_REQUIRED`).
3. **`AgentContextRefresher`**: Executes smart partial refreshes by reusing unaffected context sections (architecture, untouched features) and fetching only stale sections.
4. **`AgentContextDeltaCalculator`**: Computes fine-grained diffs between ContextPackage versions (added, removed, modified, and unchanged items) with safety checks.
5. **`AgentContextPinManager`**: Allows agents to pin features, resources, and sections to ensure retention across budget constraints.
