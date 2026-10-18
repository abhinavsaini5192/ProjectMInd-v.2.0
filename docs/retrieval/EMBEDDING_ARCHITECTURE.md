# Embedding Architecture & Provider Neutrality

## 1. Provider-Neutral Interface

ProjectMind does not hardcode third-party embedding providers into core services. All embedding operations operate via [IEmbeddingProvider](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/interfaces/IEmbeddingProvider.ts):

```typescript
export interface IEmbeddingProvider {
  readonly metadata: EmbeddingProviderMetadata;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: readonly string[]): Promise<number[][]>;
  similarity(a: readonly number[], b: readonly number[]): number;
}
```

## 2. Metadata & Versioning

Embedding models evolve over time. To avoid comparing vectors across different embedding spaces, every vector stores:
- `provider`: Identity of provider (e.g. `projectmind-local`, `openai`, `custom`).
- `model`: Embedding model identifier (e.g. `local-ngram-l2`, `text-embedding-3-small`).
- `dimension`: Vector dimensions (e.g. 128, 1536).
- `version`: Version number of embedding generation pipeline.

If model configuration changes, existing embeddings must be invalidated and re-indexed.

## 3. Local / Offline Mode

[LocalSemanticEmbeddingProvider](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/retrieval/embeddings/LocalSemanticEmbeddingProvider.ts) provides a zero-dependency, deterministic embedding implementation:
- Feature extraction: Word tokens and character 3-grams hashed across 128 feature buckets.
- Normalization: L2 vector normalization.
- Similarity: Fast dot product (equivalent to cosine similarity for normalized vectors).
- Operates entirely offline without API keys or remote network calls.
