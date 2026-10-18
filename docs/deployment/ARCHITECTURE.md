# Platform Architecture & Service Boundaries

## 1. Architectural Philosophy

ProjectMind strictly separates **Application / Domain Logic** from **Runtime & Deployment Concerns**.

The architecture adheres to an inverted dependency model where operational infrastructure remains below core domain systems:

```
                    External Coding Agent
                             │
                             ▼
                  Agent Adapter (Phase 7.9)
                             │
                             ▼
              Production Agent Runtime (Phase 7.10)
                             │
                             ▼
               ProjectMind Platform (Phase 8.1)
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   Repository            Knowledge             Context
  Intelligence            Systems            Orchestrator
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                   Runtime Infrastructure
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  Configuration        Observability           Storage
 (PlatformConfig)    (Logger + Metrics)   (IStorageProvider)
                             │
                             ▼
                      Deployment Layer
            (Bootstrap + Lifecycle + Containers)
```

## 2. Core Service Boundaries

1. **Agent Integration Layer (Phases 7.1–7.10)**:
   - External agents communicate via adapters (MCP, Generic, CLI).
   - The `ProductionAgentRuntime` coordinates sessions, tasks, context retrieval, tool invocation, execution observation, verification, and state checkpoints.
2. **Platform Coordination Layer (Phase 8.1)**:
   - `ProjectMindPlatform` unifies bootstrap, dependency validation, error boundaries, health monitoring, and shutdown hooks.
3. **Core Intelligence Layer (Phases 0–6)**:
   - `ProjectMindKernel`, Knowledge Graph, Feature Intelligence, and Context Orchestrator.
4. **Runtime Infrastructure Layer**:
   - `PlatformConfig`: Zod-validated environment configuration.
   - `ProductionLogger`: Severity-filtered, secret-redacted JSON logger.
   - `PlatformHealthService`: Canonical Liveness/Readiness/Health aggregation.
   - `PlatformMetricsCollector`: Bounded-dimension telemetry collector.
