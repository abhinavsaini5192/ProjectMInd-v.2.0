import type { IFeatureKnowledgeQueryService } from '../interfaces/IFeatureKnowledgeQueryService.js';
import type { IFeatureKnowledgePlanner } from '../interfaces/IFeatureKnowledgePlanner.js';
import type { IFeatureKnowledgeResolver } from '../interfaces/IFeatureKnowledgeResolver.js';
import type { IFeatureKnowledgeFreshnessResolver } from '../interfaces/IFeatureKnowledgeFreshnessResolver.js';
import type { IFeatureKnowledgeExplainer } from '../interfaces/IFeatureKnowledgeExplainer.js';
import type { IFeatureKnowledgeAssembler } from '../interfaces/IFeatureKnowledgeAssembler.js';
import type { FeatureKnowledgeCache } from '../cache/FeatureKnowledgeCache.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeResponse } from '../models/FeatureKnowledgeResponse.js';
import type { FeatureKnowledgeMetadata } from '../models/FeatureKnowledgeMetadata.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

import { FeatureKnowledgeValidator } from './FeatureKnowledgeValidator.js';
import { FeatureKnowledgeCacheKeyBuilder } from '../cache/FeatureKnowledgeCacheKeyBuilder.js';
import { FeatureKnowledgeQueryError } from '../errors/FeatureKnowledgeQueryError.js';

export interface FeatureKnowledgeQueryServiceDependencies {
  planner: IFeatureKnowledgePlanner;
  resolver: IFeatureKnowledgeResolver;
  freshnessResolver: IFeatureKnowledgeFreshnessResolver;
  explainer: IFeatureKnowledgeExplainer;
  assembler: IFeatureKnowledgeAssembler;
  cache?: FeatureKnowledgeCache | undefined;
}

export class FeatureKnowledgeQueryService implements IFeatureKnowledgeQueryService {
  constructor(private readonly deps: FeatureKnowledgeQueryServiceDependencies) {}

  public async query(query: FeatureKnowledgeQuery): Promise<FeatureKnowledgeResponse> {
    const startTime = Date.now();
    const requestId =
      query.requestId ?? `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Validate query
    FeatureKnowledgeValidator.validate(query);

    const cacheKey = this.deps.cache ? FeatureKnowledgeCacheKeyBuilder.buildKey(query) : '';

    // 2. Check cache if available and not explicitly disabled
    if (this.deps.cache) {
      const cached = this.deps.cache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            requestId,
            durationMs: Date.now() - startTime,
          },
        };
      }
    }

    // 3. Plan execution
    const plan = this.deps.planner.createPlan(query);

    // 4. Resolve raw sections
    const rawSections = await this.deps.resolver.resolveSections(plan, query);

    // 5. Evaluate freshness and version consistency
    const freshnessEval = this.deps.freshnessResolver.evaluateFreshness(rawSections, query);

    // Enforce freshness policy if CURRENT required
    if (query.freshness === 'CURRENT' && freshnessEval.freshness.status === 'STALE') {
      throw new FeatureKnowledgeQueryError(
        'Stale knowledge not allowed by freshness policy (CURRENT required)',
        {
          featureId: query.featureId,
          freshness: freshnessEval.freshness,
        }
      );
    }

    // 6. Generate explanations
    const explanations = this.deps.explainer.generateExplanations(
      query.featureId,
      rawSections,
      query
    );

    // 7. Assemble final profile
    const profile = this.deps.assembler.assembleProfile(
      query.featureId,
      rawSections,
      plan,
      query,
      freshnessEval,
      explanations
    );

    // 8. Collect any section-level errors
    const errors: FeatureKnowledgeErrorInfo[] = [];
    const sectionEntries = Object.values(rawSections) as any[];
    for (const section of sectionEntries) {
      if (section && section.error) {
        errors.push(section.error);
      }
    }

    // 9. Construct metadata
    const metadata: FeatureKnowledgeMetadata = {
      requestId,
      generatedAt: Date.now(),
      durationMs: Math.max(0, Date.now() - startTime),
      workspaceId: query.workspaceId ?? 'default',
      repositoryId: query.repositoryId ?? 'default',
      knowledgeVersion: freshnessEval.versionStatus.aggregateVersion,
      freshness: freshnessEval.freshness,
      versionStatus: freshnessEval.versionStatus,
    };

    const response: FeatureKnowledgeResponse = {
      success: errors.length === 0 || profile.identity.status === 'AVAILABLE',
      profile,
      metadata,
      errors: errors.length > 0 ? errors : undefined,
    };

    // 10. Store in cache if configured
    if (this.deps.cache && response.success) {
      this.deps.cache.set(cacheKey, response);
    }

    return response;
  }
}
