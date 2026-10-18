import type { RetrievalResult } from '../models/RetrievalResult.js';
import type { SemanticQuery } from '../models/SemanticQuery.js';

export interface IRetrievalRanker {
  rank(candidates: readonly RetrievalResult[], query: SemanticQuery): Promise<RetrievalResult[]>;
}

export interface IRetrievalEngine {
  retrieve(query: SemanticQuery): Promise<RetrievalResult[]>;
}
