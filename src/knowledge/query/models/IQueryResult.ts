export interface QueryExplanation {
  indexesHit: string[];
  entitiesTraversed: string[];
  relationshipsTraversed: string[];
  snapshotUsed: string;
  reasoningTrace: string[]; // Deterministic trace, e.g. "Matched filter {name} in SymbolIndex"
}

export interface IQueryResult {
  queryId: string;
  queryType: string;
  data: any;
  sources: string[]; // Entity IDs that formed the data
  confidence: number;
  explanation?: QueryExplanation;
  generatedAt: number;
  knowledgeVersion: string;
  snapshotId: string;
}

export * from './IQuery.js';
