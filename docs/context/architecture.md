# Phase 6.10: Context Orchestrator Architecture

## 1. System Role & Purpose

ProjectMind's **Context Orchestration & AI Prompt Adaptation Layer** (`src/context/`) serves as the bridge between repository intelligence (features, mappings, dependencies, behavior, health, impact, history) and AI coding agents (Claude, GPT, Gemini, Cursor, Codex).

Rather than dumping raw ASTs or entire files into LLM context windows, the Context Orchestrator:
1. **Plans** a token-budgeted, relevance-weighted context strategy tailored to the developer's task.
2. **Retrieves** verified knowledge strictly through the Phase 6.9 `FeatureKnowledgeAPI`.
3. **Selects and scores** features, resources, execution flows, tests, and risks using multi-factor relevance algorithms.
4. **Enforces** strict token budgets with deterministic truncation and compact mode representation.
5. **Packages** a canonical, provider-independent `ContextPackage` with complete provenance, completeness, and freshness metadata.
6. **Adapts** the package into model-tailored prompt formats (Claude XML, OpenAI Markdown, Gemini hierarchical headers, Cursor compact references, Codex code stubs).
7. **Protects** LLMs from prompt injection and secret leakage via strict boundary isolation and secret sanitization.

## 2. High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                                 AI Agent / Brain                                |
+---------------------------------------------------------------------------------+
                                      |
                           ContextRequest / Task
                                      v
+---------------------------------------------------------------------------------+
|                       IContextOrchestrator / ContextProvider                     |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  | 1. Context Cache                                                          |  |
|  |    TTL Cache, CacheKeyBuilder, Invalidation by RepositoryId              |  |
|  +---------------------------------------------------------------------------+  |
|                                     | (cache miss)                              |
|                                     v                                           |
|  +---------------------------------------------------------------------------+  |
|  | 2. Planning Subsystem (IContextPlanner)                                   |  |
|  |    Request Validation, Scope Resolution, Quota Allocation, Priorities      |  |
|  +---------------------------------------------------------------------------+  |
|                                     | ContextPlan                               |
|                                     v                                           |
|  +---------------------------------------------------------------------------+  |
|  | 3. Retrieval Subsystem (IContextRetriever)                                |  |
|  |    Task / Resource / Feature / Impact Retrieval via FeatureKnowledgeAPI   |  |
|  +---------------------------------------------------------------------------+  |
|                                     | RetrievedContextData                      |
|                                     v                                           |
|  +---------------------------------------------------------------------------+  |
|  | 4. Selection & Scoring Subsystem (IContextSelector)                        |  |
|  |    Multi-Factor Relevance, Deduplication, Cross-Feature Binding           |  |
|  +---------------------------------------------------------------------------+  |
|                                     | SelectedContextData                       |
|                                     v                                           |
|  +---------------------------------------------------------------------------+  |
|  | 5. Token Budgeting Subsystem (ITokenBudgetManager)                        |  |
|  |    Token Estimator, Compression Policy, Deterministic Quota Truncation   |  |
|  +---------------------------------------------------------------------------+  |
|                                     | BudgetedContextResult                     |
|                                     v                                           |
|  +---------------------------------------------------------------------------+  |
|  | 6. Packing & Integrity Subsystem (IContextPacker)                         |  |
|  |    Secret Sanitization, Circular Dep Check, Completeness & Freshness     |  |
|  +---------------------------------------------------------------------------+  |
|                                     | ContextPackage (Canonical)                |
|                                     v                                           |
|  +---------------------------------------------------------------------------+  |
|  | 7. Model Adapters (AdapterRegistry)                                       |  |
|  |    Generic Markdown | Claude XML | OpenAI | Gemini | Cursor | Codex | JSON |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
                                      |
                               ContextResponse
                                      v
+---------------------------------------------------------------------------------+
|                                Delivered Prompt                                 |
+---------------------------------------------------------------------------------+
```

## 3. Subsystem Breakdown

| Subsystem | Key Interfaces / Classes | Primary Responsibilities |
| :--- | :--- | :--- |
| **Orchestrator** | `ContextOrchestrator`, `ContextRequestResolver` | End-to-end execution, request lifecycle, timings, response assembly |
| **Planning** | `ContextPlanner`, `ContextPlanBuilder`, `ContextPlanValidator` | Request validation, section token quota calculation, priority assignment |
| **Retrieval** | `ContextRetrievalCoordinator`, `FeatureContextRetriever` | Delegation to Phase 6.9 `IFeatureKnowledgeAPI`, dependency expansion |
| **Selection** | `ContextSelector`, `ContextRelevanceScorer`, `ContextDeduplicator` | Multi-factor feature and resource scoring, deduplication, cross-references |
| **Budgeting** | `TokenBudgetManager`, `TokenEstimator`, `ContextBudgetAllocator` | Token estimation, section quota enforcement, deterministic truncation |
| **Packing** | `ContextPackageBuilder`, `ContextIntegrityValidator`, `MetadataPacker` | Canonical model construction, secret sanitization, provenance |
| **Adapters** | `AdapterRegistry`, `AnthropicContextAdapter`, `GenericModelAdapter` | Model-specific prompt composition with XML or Markdown |
| **Cache** | `ContextCache`, `ContextCacheKeyBuilder` | In-memory response caching, freshness policies, repository invalidation |
| **Provider** | `ContextProvider` | Brain subsystem integration contract (`IContextProvider`) |
| **DI** | `ContextTokens`, `ContextOrchestratorDISetup` | Clean dependency injection registration for ProjectMind DI container |
