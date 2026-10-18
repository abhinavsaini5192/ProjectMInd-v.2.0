# Architecture & Core Design Principles

## Core Architectural Principle

The Feature Knowledge API is an **aggregation and query orchestration layer**.

```
Client / Future Integrations (Context Orchestrator)
                    ↓
          Feature Knowledge API
                    ↓
          Feature Knowledge Query Service
                    ↓
      ┌─────────────┼─────────────┐
      ↓             ↓             ↓
Query Planner   Validator      Cache
      ↓
Feature Knowledge Resolver
      ↓
┌─────────────────────────────────────────────────────────┐
│              Existing Subsystem Repositories             │
│  - FeatureRepository (Phase 6.1)                       │
│  - FeatureMappingRepository (Phase 6.3)                │
│  - FeatureRelationshipRepository (Phase 6.4)           │
│  - FeatureBehaviorRepository (Phase 6.5)               │
│  - FeatureHealthRepository (Phase 6.6)                 │
│  - ImpactRepository (Phase 6.7)                        │
│  - FeatureHistoryRepository (Phase 6.8)                │
└─────────────────────────────────────────────────────────┘
      ↓
Feature Knowledge Assembler & Freshness Resolver
      ↓
Unified Feature Knowledge Profile / Response
```

---

## Strict Non-Duplication Guarantees

Phase 6.9 strictly abides by architectural boundaries:
1. **No Duplicate Feature Registries**: Reads directly from `IFeatureRepository`.
2. **No Duplicate Mapping Engines**: Delegates to `IFeatureMappingRepository`.
3. **No Duplicate Graph Engines**: Delegates to `IFeatureRelationshipRepository`.
4. **No Duplicate Flow Analyzers**: Reads from `IFeatureBehaviorRepository`.
5. **No Duplicate Health Engines**: Reads from `IFeatureHealthRepository`.
6. **No Duplicate Impact Evaluators**: Reads from `IImpactRepository`.
7. **No Duplicate History Analyzers**: Reads from `IFeatureHistoryRepository`.
8. **No Direct Database Access**: No raw SQLite or database drivers in the API layer.
9. **No Filesystem or Git Access**: No AST parsing or git CLI invocations in the API layer.
10. **No SLM/AI Calls for Query Planning**: Deterministic TypeScript planning based on graph dependencies.

---

## Dependency Injection Setup

All dependencies are registered in `DIContainer` through `FeatureKnowledgeTokens`:

```typescript
export const FeatureKnowledgeTokens = {
  Planner: Symbol('FeatureKnowledgePlanner'),
  FreshnessResolver: Symbol('FeatureKnowledgeFreshnessResolver'),
  Explainer: Symbol('FeatureKnowledgeExplainer'),
  Assembler: Symbol('FeatureKnowledgeAssembler'),
  Resolver: Symbol('FeatureKnowledgeResolver'),
  QueryService: Symbol('FeatureKnowledgeQueryService'),
  API: Symbol('FeatureKnowledgeAPI'),
  ReadRepository: Symbol('FeatureKnowledgeReadRepository'),
  Cache: Symbol('FeatureKnowledgeCache'),
};
```
