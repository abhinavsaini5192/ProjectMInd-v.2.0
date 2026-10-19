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

      // 3. Cosine Similarity & Relevance Calculation
      const similarity = LocalSemanticEmbeddingProvider.cosineSimilarity(
        queryVector,
        entry.embedding
      );

      let effectiveScore = similarity;
      if (options.queryText) {
        const qLower = options.queryText.toLowerCase().trim();
        const titleLower = entry.title.toLowerCase();
        const symbolLower = typeof entry.metadata?.['symbolName'] === 'string'
          ? (entry.metadata['symbolName'] as string).toLowerCase()
          : undefined;

        const isExactSymbol = titleLower === qLower || symbolLower === qLower;
        const filePath = (entry.metadata?.['filePath'] as string) ?? entry.contentReference ?? entry.resourceId;
        const isTest = titleLower.startsWith('test_') || titleLower.endsWith('_test') || filePath.toLowerCase().includes('test');

        if (isExactSymbol && !isTest) {
          // Exact implementation of the queried symbol: guaranteed top-tier relevance
          effectiveScore = Math.min(1.0, Math.max(0.95, similarity + 0.50));
        } else if (isExactSymbol && isTest) {
          // Exact test for the queried symbol
          effectiveScore = Math.min(0.85, similarity + 0.25);
        } else if (
          titleLower.split(/\W+/).includes(qLower) ||
          (symbolLower && symbolLower.split(/\W+/).includes(qLower))
        ) {
          effectiveScore = Math.min(0.80, similarity + 0.20);
        } else if (titleLower.includes(qLower)) {
          effectiveScore = Math.min(0.75, similarity + 0.10);
        }
      }

      if (effectiveScore >= minScore) {
        results.push({
          entry,
          similarityScore: effectiveScore,
        });
      }
    }

    // Sort descending by similarity
    results.sort((a, b) => b.similarityScore - a.similarityScore);

    return results.slice(0, limit);
  }

  public async invalidate(resourceId: string, repositoryId: string): Promise<void> {
    const directKey = this.makeKey(repositoryId, resourceId);
    let updated = false;

    const existing = this.entries.get(directKey);
    if (existing) {
      this.entries.set(directKey, {
        ...existing,
        updatedAt: Date.now(),
        metadata: {
          ...existing.metadata,
          isStale: true,
          invalidatedAt: Date.now(),
        },
      });
      updated = true;
    }

    // Also invalidate any chunk entries belonging to this file resource
    for (const [key, entry] of this.entries.entries()) {
      if (
        entry.repositoryId === repositoryId &&
        (entry.contentReference === resourceId || entry.resourceId.startsWith(`${resourceId}#`))
      ) {
        this.entries.set(key, {
          ...entry,
          updatedAt: Date.now(),
          metadata: {
            ...entry.metadata,
            isStale: true,
            invalidatedAt: Date.now(),
          },
        });
        updated = true;
      }
    }

    if (updated) {
      this.version++;
    }
  }

  public async remove(resourceId: string, repositoryId: string): Promise<void> {
    const directKey = this.makeKey(repositoryId, resourceId);
    let deleted = this.entries.delete(directKey);

    // Also remove any chunk entries belonging to this file resource
    for (const [key, entry] of this.entries.entries()) {
      if (
        entry.repositoryId === repositoryId &&
        (entry.contentReference === resourceId || entry.resourceId.startsWith(`${resourceId}#`))
      ) {
        this.entries.delete(key);
        deleted = true;
      }
    }

    if (deleted) {
      this.version++;
    }
  }

  public async getEntry(
    resourceId: string,
    repositoryId: string
  ): Promise<SemanticIndexEntry | undefined> {
    const direct = this.entries.get(this.makeKey(repositoryId, resourceId));
    if (direct) return direct;

    // Check for chunk entries belonging to this file resource
    for (const entry of this.entries.values()) {
      if (
        entry.repositoryId === repositoryId &&
        (entry.contentReference === resourceId || entry.resourceId.startsWith(`${resourceId}#`))
      ) {
        return entry;
      }
    }

    return undefined;
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
