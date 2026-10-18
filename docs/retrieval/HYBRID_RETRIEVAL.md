# Hybrid Retrieval in ProjectMind

## 1. Pipeline Execution Flow

Hybrid retrieval combines lexical, graph, feature, and semantic retrieval into a single coherent retrieval stream:

```
                    User / Agent Task
                           ↓
                Advanced Context Intelligence (Phase 9.3)
                           ↓
                  Semantic Retrieval Engine (Phase 9.4)
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
   Structured Facts   Semantic Memory    Historical Memory
  (Features/Symbols)   (Vector Index)     (Decisions/ADRs)
        ↓                  ↓                  ↓
        └──────────────────┼──────────────────┘
                           ↓
               Multi-Dimensional Ranking
                           ↓
                  Conflict Resolution
                           ↓
                    Context Package
```

## 2. Multi-Source Integration

[HybridRetrievalEngine](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/engine/HybridRetrievalEngine.ts) resolves results from:

1. `STRUCTURED_KNOWLEDGE`: Direct AST symbols, modules, and files.
2. `FEATURE_KNOWLEDGE`: Primary/secondary feature mappings from [IFeatureRepository](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/knowledge/features/interfaces/IFeatureRepository.ts).
3. `KNOWLEDGE_GRAPH`: Entity relationships and architecture topologies.
4. `PROJECT_MEMORY`: Durable architectural decisions, migrations, and post-mortems from [IProjectMemoryStore](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/memory/project/interfaces/IProjectMemoryStore.ts).
5. `SEMANTIC_INDEX`: Vector embeddings over semantic chunks.

## 3. Candidate Deduplication & Enrichment

When a resource is found both deterministically and semantically:
- The authoritative identity and provenance are preserved.
- The candidate is enriched with semantic similarity dimensions and vector relevance scores.
- Duplicate entries are merged without inflating token footprints.
