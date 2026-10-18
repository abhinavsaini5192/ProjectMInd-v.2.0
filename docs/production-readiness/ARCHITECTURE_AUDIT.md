# ProjectMind Architecture Conformance & Boundary Audit

## 1. Architectural Conformance Principles

The ProjectMind architecture is strictly organized into clean, unidirectional layers to ensure that core intelligence logic remains deterministic, testable, and infrastructure-neutral.

```
External Coding Agent (Cursor, Claude, Copilot, Custom Agents)
        ↓  (MCP / JSON-RPC / REST API)
Transport Boundary & Adapters (`src/api/`, `src/agent/adapters/`)
        ↓
Production Agent Runtime (`src/agent/runtime/`)
        ↓
Context Orchestrator (`src/context/`)
        ↓
Feature Intelligence & Knowledge Graph (`src/knowledge/features/`, `src/graph/`)
        ↓
Knowledge Update Loop (`src/knowledge/update/`)
        ↓
Kernel & Workspace Management (`src/kernel/`, `src/workspace/`)
        ↓
Persistence & Storage Abstractions (`src/storage/`)
```

---

## 2. Invariant & Boundary Verification

### 2.1 Kernel Infrastructure Neutrality
- **Audit Findings:** `ProjectMindKernel` (`src/kernel/ProjectMindKernel.ts`) does not import HTTP servers, Express, cloud SDKs, or external messaging transports.
- **Dependency Flow:** Kernel interacts only with workspace filesystems, storage abstractions (`IStorageProvider`), and in-memory event buses (`IEventBus`).
- **Status:** **CONFORMANT**

### 2.2 Extraction Engine Determinism
- **Audit Findings:** `src/extraction/` uses AST tree-sitter parsers without non-deterministic heuristics. Identical source code yields identical syntax trees, symbols, and relationship graphs.
- **Status:** **CONFORMANT**

### 2.3 Repository Intelligence vs Feature Intelligence Separation
- **Audit Findings:** Repository intelligence (`src/intelligence/`) manages AST graphs, symbol tables, and code structure. Feature intelligence (`src/knowledge/features/`) manages high-level features, user intents, health scores, and change impacts. The two systems interact via typed interfaces without tight circular coupling.
- **Status:** **CONFORMANT**

### 2.4 Single Canonical Context Orchestrator
- **Audit Findings:** Context planning, resource ranking, and token budget packing are centralized under `src/context/`. Adapters in `src/agent/adapters/` do not create ad-hoc context packages; they request packages through `IContextOrchestrator`.
- **Status:** **CONFORMANT**

### 2.5 Brain & Reasoning Independence
- **Audit Findings:** Reasoning heuristics in `src/brain/` provide advice and task plans without mutating the knowledge graph directly. All state updates pass through the Knowledge Update Loop.
- **Status:** **CONFORMANT**

### 2.6 Thin Agent Adapters & MCP Isolation
- **Audit Findings:** The Model Context Protocol (MCP) server in `src/agent/` acts strictly as an external integration protocol. It exposes tools that delegate to `AgentToolPipeline` and `AgentSessionManager`. It contains zero domain intelligence.
- **Status:** **CONFORMANT**

### 2.7 Zero Subsystem Duplication
A comprehensive codebase audit confirms single canonical implementations for all core platform capabilities:
- **Dependency Injection:** Exactly one container (`src/workspace/di/DIContainer.ts`).
- **Event Bus:** Exactly one canonical event bus (`src/workspace/events/NodeEventBus.ts`).
- **Security:** Exactly one `SecurityManager` (`src/security/SecurityManager.ts`).
- **Job Queue:** Exactly one `InMemoryJobQueue` (`src/jobs/queue/InMemoryJobQueue.ts`).
- **Storage Abstraction:** Single `IStorageProvider` interface (`src/storage/IStorageProvider.ts`).
- **Lock Manager:** Single `ResourceLockManager` (`src/concurrency/locking/ResourceLockManager.ts`).
- **Health Service:** Single `PlatformHealthService` (`src/platform/health/PlatformHealthService.ts`).
- **Status:** **ZERO DUPLICATION VERIFIED**

---

## 3. Dependency Direction Flow

```
Level 0: Interfaces & Errors (`src/interfaces/`, `src/errors/`)
   ↑
Level 1: Storage & Workspace (`src/storage/`, `src/workspace/`)
   ↑
Level 2: Kernel & Extraction (`src/kernel/`, `src/extraction/`)
   ↑
Level 3: Repository & Feature Knowledge (`src/intelligence/`, `src/knowledge/`)
   ↑
Level 4: Context Orchestration (`src/context/`)
   ↑
Level 5: Agent Runtime & Execution (`src/agent/runtime/`)
   ↑
Level 6: API, Adapters & Platform Bootstrap (`src/api/`, `src/platform/`)
```

- Higher levels import from lower levels.
- Lower levels **never** import from higher levels.
- All cross-cutting concerns (Security, Observability, Concurrency, Reliability) communicate via interfaces registered in `DIContainer` or events published over `NodeEventBus`.

---

## 4. Forbidden Patterns Audit

| Rule | Check | Result |
|---|---|---|
| No direct database access from API controllers | Controllers must call services | **PASSED** |
| No shell execution in agent runtime | Runtime executes approved tools only | **PASSED** |
| No external network calls in core kernel | Kernel operates on local workspace | **PASSED** |
| No circular imports between modules | Monitored by test suites and packaging | **PASSED** |
| No unvalidated type mutations in adapters | Adapters parse with strict schemas | **PASSED** |
