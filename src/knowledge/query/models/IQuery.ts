export interface IQuery {
  id?: string;
  entity: 'repository' | 'symbol' | 'feature' | 'relationship' | 'dependency' | 'architecture' | 'evolution' | 'impact';
  operation: string;
  filters: Record<string, any>;
  include?: string[]; // e.g. ['dependencies', 'features']
  snapshotId?: string; // For historical queries
  repositoryId?: string; // Context bounds
}

export * from './IQueryResult.js';
