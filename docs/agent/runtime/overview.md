# ProjectMind Production Agent Runtime Overview

## 1. Purpose & Scope

The **Production Agent Runtime** is the operational engine that turns ProjectMind's modular agent subsystems into a unified, provider-neutral, closed-loop operating environment for external AI coding agents.

It governs the complete lifecycle of agent interaction:
```
External Agent
      │
      ▼
Agent Adapter (Phase 7.9)
      │
      ▼
Production Agent Runtime (Phase 7.10)
      ├── Session Coordinator (Phase 7.1 + 7.10)
      ├── Task Coordinator (Phase 7.5 + 7.10)
      ├── Context Coordinator (Phase 7.4 + 7.10)
      ├── Tool Coordinator (Phase 7.2 + 7.10)
      ├── Observation Coordinator (Phase 7.6 + 7.10)
      ├── Verification Coordinator (Phase 7.7 + 7.10)
      └── Knowledge Update Loop (Phase 7.8 + 7.10)
```

## 2. Core Principles

1. **Operating Runtime, Not Autonomous Agent**: ProjectMind is the repository intelligence runtime around external agents, not an autonomous agent that generates code or parses ASTs.
2. **Provider Neutrality**: ProjectMind treats external agents identically, relying on Agent Adapters (Phase 7.9) for protocol translation.
3. **Closed-Loop Feedback**: Observations from tool executions and verification reports feed back into knowledge updates, which in turn trigger smart context invalidation and refresh.
4. **Anti-Elevation of Trust**: Claims made by external agents remain labeled `AGENT_REPORTED` until confirmed through independent verification.
5. **Strict Multi-Tenant Isolation**: Every session, task, context session, tool call, and checkpoint is strictly bounded by `workspaceId` and `repositoryId`.
6. **Robust Resiliency**: Serializable runtime checkpoints and structured recovery planners ensure that runtime failovers or crashes recover cleanly without losing session or task alignment.
