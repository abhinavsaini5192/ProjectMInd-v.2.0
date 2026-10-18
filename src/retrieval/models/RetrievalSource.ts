export type RetrievalSource =
  | 'STRUCTURED_KNOWLEDGE'
  | 'FEATURE_KNOWLEDGE'
  | 'KNOWLEDGE_GRAPH'
  | 'SYMBOL_INDEX'
  | 'TEXT_INDEX'
  | 'SEMANTIC_INDEX'
  | 'HISTORY'
  | 'PROJECT_MEMORY'
  | 'VERIFICATION'
  | 'HEALTH'
  | 'IMPACT'
  | 'DOCUMENTATION';

export type SourceAuthority =
  | 'STRUCTURED_REPOSITORY_FACTS' // Highest authority: verified code AST, compiler outputs
  | 'VERIFIED_PROJECT_DECISIONS'  // Explicitly accepted/promoted architectural decisions
  | 'VERIFIED_HISTORICAL_FACTS'   // Git commits, recorded test failures
  | 'DERIVED_INTELLIGENCE'        // Computed impact, dependency graphs, health scores
  | 'SEMANTIC_RETRIEVAL'          // Vector embeddings, cosine similarity matches
  | 'AI_GENERATED_SUGGESTIONS';   // Lowest: speculative LLM outputs

export const SOURCE_AUTHORITY_RANK: Record<SourceAuthority, number> = {
  STRUCTURED_REPOSITORY_FACTS: 100,
  VERIFIED_PROJECT_DECISIONS: 85,
  VERIFIED_HISTORICAL_FACTS: 75,
  DERIVED_INTELLIGENCE: 60,
  SEMANTIC_RETRIEVAL: 40,
  AI_GENERATED_SUGGESTIONS: 20,
};
