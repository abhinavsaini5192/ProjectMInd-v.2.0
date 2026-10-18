# ProjectMind Agent Adapters — Architecture & System Design

## 1. Overview & Purpose

ProjectMind maintains structured, persistent intelligence about a software repository—including feature dependencies, health metrics, architecture topology, execution traces, and verification evidence.

External AI coding agents—such as **Claude Code**, **Cursor**, **Codex / OpenAI**, **Windsurf**, **Aider**, and **GitHub Copilot**—interact with tools and context through wildly different protocols, envelope shapes, schema conventions, and session models.

**Phase 7.9 (Agent Adapters)** introduces a provider-neutral adapter layer that translates ProjectMind's canonical agent runtime, tool protocol, and context orchestrator into the native conventions required by external coding agents **without contaminating ProjectMind's core with provider-specific logic**.

```
+-------------------------------------------------------------------------------+
|                        External AI Coding Agents                              |
|   Claude Code CLI  |  Cursor / Windsurf IDE  |  Aider  |  OpenAI Assistants   |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                    ProjectMind Agent Adapter Layer                            |
|                                                                               |
|   +-----------------------+   +-----------------------+   +---------------+   |
|   |  GenericAgentAdapter  |   |    McpAgentAdapter    |   | GenericCli    |   |
|   +-----------------------+   +-----------------------+   +---------------+   |
|   |   IdeAgentAdapter     |   | Provider Adapters     |   | CustomAdapter |   |
|   +-----------------------+   +-----------------------+   +---------------+   |
|                                                                               |
|   Core Pipeline:                                                              |
|   - AgentAdapterResolver (Deterministic, non-LLM provider & protocol matching)|
|   - AgentAdapterValidator (Scope boundary enforcement & anti-elevation checks)|
|   - AgentProtocolTranslator (AdapterRequest <-> AgentRequest translation)    |
|   - AgentToolMapper (Canonical tools -> OpenAI / Anthropic / IDE schemas)     |
|   - AgentContextMapper (ContextPackage -> Markdown / JSON / XML / RAW)        |
|   - AgentSessionMapper (External provider session IDs <-> Canonical session) |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                      ProjectMind Canonical Core                               |
|   Agent Runtime (7.1) | Tool Protocol (7.2) | Context Orchestrator (7.4)      |
|   Task Runtime (7.5)  | Observation (7.6)   | Verification (7.7)              |
|   Knowledge Update Loop (7.8)               | Knowledge Graph & Features      |
+-------------------------------------------------------------------------------+
```

---

## 2. Core Non-Negotiable Architectural Invariants

1. **Provider Neutrality**: ProjectMind core modules (`kernel`, `intelligence`, `context`, `tasks`, `observation`, `verification`, `knowledge`) contain zero references, imports, or dependencies on specific providers (Anthropic, OpenAI, Cursor, etc.).
2. **Zero Core Contamination**: Provider quirks, protocol transformations, schema adjustments, and prompt templating are isolated entirely inside the adapter boundary.
3. **No Duplicate Intelligence**: Adapters NEVER scan the repository, parse code ASTs, compute dependency graphs, rank features, or evaluate repository health. Adapters only *translate*.
4. **Anti-Elevation of Trust**: External agent claims of success, verification, or test passage must remain strictly `AGENT_REPORTED`. Adapters cannot promote external claims into kernel-verified facts.
5. **Fail-Isolation**: If an external provider adapter fails, crashes, or produces invalid output, the failure is caught and returned as a structured error response (`status: 'ERROR'`). It never crashes the host process or corrupts canonical state.
6. **Zero Autonomous Shell/Process Execution**: Adapters contain no `child_process.spawn`, `exec`, or shell execution capabilities. Tool execution occurs exclusively through the sandboxed, permissioned canonical `AgentToolPipeline`.

---

## 3. Component Hierarchy

### `IAgentAdapter`
The central interface for all adapters:
- `metadata: AdapterMetadata`: Complete metadata including ID, provider, protocol, supported capabilities, and limits.
- `status: AgentAdapterStatus`: State machine (`UNINITIALIZED` -> `INITIALIZING` -> `READY` -> `DEGRADED` -> `FAILED` -> `SHUTTING_DOWN` -> `STOPPED`).
- `translateRequest(rawRequest)`: Normalizes external payloads into canonical `AdapterRequest`.
- `translateResponse(canonicalResponse, requestEnvelope)`: Formats canonical results into provider-expected structures.
- `mapTool(tool)`: Translates canonical `AgentTool` into provider schema.
- `mapContext(context, targetFormat)`: Formats `ContextPackage` into target format without re-ranking.
- `mapSession(providerSessionId)`: Links provider session with canonical session.

### `AgentAdapterRegistry`
Thread-safe in-memory registry holding all active adapters:
- Lookup by ID, provider (`getByProvider`), protocol (`getByProtocol`), or agent type (`getByAgentType`).
- Emits lifecycle events (`agent.adapter.registered`).
- Fully backward compatible with legacy Phase 7.1 `IAdapterRegistry`.

### `AgentAdapterResolver`
Deterministic matching engine that chooses the optimal adapter without LLM intervention:
- ID match -> Provider match -> Protocol match -> Version compatibility -> Capability coverage -> Tie-breakers (version desc, ID asc).

### `AgentAdapterManager`
Orchestrates adapter lifecycle, validation, translation, event dispatching, and fail-safe error isolation.
