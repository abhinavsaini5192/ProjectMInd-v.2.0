import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';

export class FeatureKnowledgeCacheKeyBuilder {
  public static buildKey(query: FeatureKnowledgeQuery): string {
    const ws = query.workspaceId || 'default_ws';
    const repo = query.repositoryId || 'default_repo';
    const fid = query.featureId;
    const sections = query.sections ? [...query.sections].sort().join(',') : 'ALL';
    const depth = query.maxDepth ?? 'default_depth';
    const budget = query.tokenBudget ?? 'default_budget';
    const freshness = query.freshness ?? 'CURRENT';
    const version = query.knowledgeVersion ?? 'latest';
    const compact = query.compactMode ? '1' : '0';
    const inactive = query.includeInactive ? '1' : '0';

    return `${ws}:${repo}:${fid}:${sections}:${depth}:${budget}:${freshness}:${version}:${compact}:${inactive}`;
  }
}
