# Semantic Retrieval Architecture

## 1. Overview & Core Philosophy

Semantic retrieval in ProjectMind provides vector-space candidate discovery to complement deterministic repository intelligence.

```
┌─────────────────────────────────────────────────────────────┐
│                   CORE ARCHITECTURAL PRINCIPLE               │
├─────────────────────────────────────────────────────────────┤
│  SEMANTIC RETRIEVAL ≠ KNOWLEDGE AUTHORITY                  │
│  PROJECT MEMORY ≠ RAW CHAT HISTORY                          │
│  EMBEDDINGS ≠ TRUTH                                         │
│  AI-GENERATED MEMORY ≠ VERIFIED FACT                        │
└─────────────────────────────────────────────────────────────┘
```

Semantic similarity represents probabilistic similarity between a query representation and indexed content snippets. It does not confer authority or override structured compiler or AST facts.

## 2. Retrieval Paths

ProjectMind operates two complementary retrieval paths:

### Path A: Deterministic Retrieval
- **Input**: Structured query, symbol references, feature identifiers, dependency graphs, or explicit history markers.
- **Components**: Feature Knowledge API, Knowledge Graph, Repository AST, Test Verifications.
- **Output**: Authoritative structured facts (`AUTHORITATIVE_FACTS`, `VERIFIED_PROJECT_DECISIONS`).

### Path B: Semantic Retrieval
- **Input**: Natural language intent, task descriptions, contextual questions.
- **Components**: [LocalSemanticEmbeddingProvider](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/embeddings/LocalSemanticEmbeddingProvider.ts), [SemanticIndex](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/index/SemanticIndex.ts).
- **Output**: Ranked candidate references with similarity scores (`SEMANTIC_RETRIEVAL`, `DERIVED_INTELLIGENCE`).

## 3. Interfaces & Contracts

The canonical abstraction is defined in [IRetrievalEngine.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/interfaces/IRetrievalEngine.ts):

- `IRetrievalEngine`: Executes hybrid retrieval combining deterministic and semantic pipelines.
- `IRetrievalRanker`: Evaluates 10-dimensional relevance, detects contradictions, and orders candidates.
- `ISemanticIndex`: Manages embeddings, vector nearest-neighbor search, and versioned invalidation.
- `IEmbeddingProvider`: Pluggable, provider-neutral embedding generation with dimension and model version tracking.

## 4. Failure Mode & Fallback

If an external embedding provider fails or semantic search is unavailable:
1. Deterministic retrieval continues uninterrupted.
2. Context intelligence falls back to structured knowledge, feature mappings, and AST graphs.
3. The platform remains 100% operational in offline / degraded environments.
