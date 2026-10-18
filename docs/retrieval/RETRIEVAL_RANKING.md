# Retrieval Ranking & Conflict Handling

## 1. 10-Dimensional Scoring Model

[HybridRetrievalRanker](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/ranking/HybridRetrievalRanker.ts) computes candidate scores across 10 transparent dimensions:

1. `lexicalRelevance`: Exact term and keyword matches.
2. `semanticRelevance`: Cosine vector similarity.
3. `featureRelevance`: Direct participation in target feature profile.
4. `graphRelevance`: Dependency topology and coupling.
5. `taskRelevance`: Alignment with task intent and command type.
6. `recency`: Temporal recency of modification or event.
7. `confidence`: Source certainty score (0.0 to 1.0).
8. `sourceAuthority`: Hierarchy rank based on provenance (0.0 to 1.0).
9. `scopeRelevance`: 1.0 for valid project scope, 0.0 for foreign scopes.
10. `verificationRelevance`: Test passes/failures associated with resource.

## 2. Source Authority Hierarchy

Source authority is ranked explicitly in [RetrievalSource.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/models/RetrievalSource.ts):

| Source Authority Level | Weight | Description |
| :--- | :--- | :--- |
| `AUTHORITATIVE_FACTS` | 100 | Verified code AST, compiler outputs, explicit repository facts |
| `VERIFIED_PROJECT_DECISIONS` | 90 | Human ADRs and verified team architecture decisions |
| `VERIFIED_HISTORICAL_FACTS` | 80 | Git commit history, release tags, verified build logs |
| `DERIVED_INTELLIGENCE` | 60 | Feature mappings, graph clustering, risk calculations |
| `SEMANTIC_RETRIEVAL` | 40 | Cosine similarity against documentation and code snippets |
| `AI_GENERATED_SUGGESTIONS` | 20 | Unverified agent suggestions and hypothetical completions |

## 3. Conflict Detection & Resolution

When candidate statements contradict one another (e.g. an old semantic documentation chunk claiming "Authentication uses Redis" while an active ADR states "Authentication migrated away from Redis"):
1. The ranker detects the contradiction using keyword patterns (`migrated away`, `deprecated`, `no longer`) over related resources.
2. Both candidates are annotated with a `RetrievalConflict` record.
3. The higher-authority source takes precedence. Lower-authority probabilistic matches cannot override verified decisions or code facts.
