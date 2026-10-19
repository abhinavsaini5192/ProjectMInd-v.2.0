export interface SemanticIndexEntry {
  readonly resourceId: string;
  readonly resourceType: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly repositoryId: string;
  readonly title: string;
  readonly contentReference?: string | undefined;
  readonly snippet?: string | undefined;
  readonly embedding: number[];
  readonly embeddingVersion: string;
  readonly sourceVersion: string | number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly metadata?: Record<string, any> | undefined;
}

export interface SemanticSearchOptions {
  readonly limit?: number | undefined;
  readonly minScore?: number | undefined;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly resourceTypes?: string[] | undefined;
  readonly queryText?: string | undefined;
}

export interface SemanticSearchResult {
  readonly entry: SemanticIndexEntry;
  readonly similarityScore: number;
}

export interface ISemanticIndex {
  index(entry: SemanticIndexEntry): Promise<void>;
  indexBatch(entries: SemanticIndexEntry[]): Promise<void>;
  search(queryVector: number[], options?: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
  invalidate(resourceId: string, repositoryId: string): Promise<void>;
  remove(resourceId: string, repositoryId: string): Promise<void>;
  getEntry(resourceId: string, repositoryId: string): Promise<SemanticIndexEntry | undefined>;
  listEntries(repositoryId: string, limit?: number): Promise<SemanticIndexEntry[]>;
  getVersion(): number;
}
