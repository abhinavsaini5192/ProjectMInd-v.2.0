# Semantic Index Architecture

## 1. Index Structure & Model

The semantic index tracks versioned embeddings for repository chunks while strictly enforcing project and workspace isolation boundaries:

- Model: `SemanticIndexEntry`
  - `resourceId`: Canonical identifier of the target file or symbol.
  - `resourceType`: Resource classification (`FILE`, `CLASS`, `FUNCTION`, `DOCUMENTATION`, `DECISION`).
  - `workspaceId`: Workspace isolation partition.
  - `projectId`: Optional project scope isolation partition.
  - `repositoryId`: Repository identity.
  - `embedding`: Vector representation.
  - `embeddingVersion`: Model version that produced the embedding.
  - `sourceVersion`: Content hash or version identifier of source text.
  - `isStale`: Boolean flag indicating if source changed.

## 2. Semantic Chunking Boundaries

Arbitrary fixed-character chunking is strictly avoided. [SemanticChunker](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/index/SemanticChunker.ts) chunks along semantic structural boundaries:

- Source code: Class definitions, methods, exported functions, module headers.
- Documentation: Markdown H1/H2/H3 sections, ADR sections, decision records.

Every chunk retains:
- Full resource identity and path.
- Source start and end line ranges.
- Project and workspace scope tags.

## 3. Incremental Updates & Invalidation

When a source file is modified or deleted:
1. `semanticIndex.invalidate(resourceId, repositoryId)` marks existing embeddings as stale.
2. Full index rebuilds are prevented.
3. An asynchronous indexing job is enqueued to recompute embeddings for modified chunks only.
