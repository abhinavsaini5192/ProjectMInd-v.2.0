import type {
  ISemanticIndex,
  SemanticIndexEntry,
  SemanticSearchOptions,
  SemanticSearchResult,
} from '../interfaces/ISemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../embeddings/LocalSemanticEmbeddingProvider.js';

export class SemanticIndex implements ISemanticIndex {
  private readonly entries = new Map<string, SemanticIndexEntry>(); // key: `${repoId}:${resId}`
  private version: number = 1;

  private makeKey(repoId: string, resId: string): string {
    return `${repoId}:${resId}`;
  }

  public async index(entry: SemanticIndexEntry): Promise<void> {
    const key = this.makeKey(entry.repositoryId, entry.resourceId);
    this.entries.set(key, entry);
    this.version++;
  }

  public async indexBatch(entries: SemanticIndexEntry[]): Promise<void> {
    for (const entry of entries) {
      const key = this.makeKey(entry.repositoryId, entry.resourceId);
      this.entries.set(key, entry);
    }
    this.version++;
  }

  public async search(
    queryVector: number[],
    options: SemanticSearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    const minScore = options.minScore ?? 0.1;
    const limit = options.limit ?? 10;
    const results: SemanticSearchResult[] = [];

    for (const entry of this.entries.values()) {
      // 1. Scope Checks
      if (options.repositoryId && entry.repositoryId !== options.repositoryId) {
        continue;
      }
      if (options.workspaceId && entry.workspaceId !== options.workspaceId) {
        continue;
      }
      if (options.projectId && entry.projectId && entry.projectId !== options.projectId) {
        continue;
      }

      // 2. Type Filter
      if (options.resourceTypes && options.resourceTypes.length > 0) {
        if (!options.resourceTypes.includes(entry.resourceType)) {
          continue;
        }
      }

      // 3. Cosine Similarity
      const similarity = LocalSemanticEmbeddingProvider.cosineSimilarity(
        queryVector,
        entry.embedding
      );

      if (similarity >= minScore) {
        results.push({
          entry,
          similarityScore: similarity,
        });
      }
    }

    // Sort descending by similarity
    results.sort((a, b) => b.similarityScore - a.similarityScore);

    return results.slice(0, limit);
  }

  public async invalidate(resourceId: string, repositoryId: string): Promise<void> {
    const key = this.makeKey(repositoryId, resourceId);
    const existing = this.entries.get(key);
    if (existing) {
      // Update with stale indicator metadata
      this.entries.set(key, {
        ...existing,
        updatedAt: Date.now(),
        metadata: {
          ...existing.metadata,
          isStale: true,
          invalidatedAt: Date.now(),
        },
      });
      this.version++;
    }
  }

  public async remove(resourceId: string, repositoryId: string): Promise<void> {
    const key = this.makeKey(repositoryId, resourceId);
    if (this.entries.delete(key)) {
      this.version++;
    }
  }

  public async getEntry(
    resourceId: string,
    repositoryId: string
  ): Promise<SemanticIndexEntry | undefined> {
    return this.entries.get(this.makeKey(repositoryId, resourceId));
  }

  public async listEntries(repositoryId: string, limit: number = 100): Promise<SemanticIndexEntry[]> {
    const matches: SemanticIndexEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.repositoryId === repositoryId) {
        matches.push(entry);
        if (matches.length >= limit) break;
      }
    }
    return matches;
  }

  public getVersion(): number {
    return this.version;
  }
}
