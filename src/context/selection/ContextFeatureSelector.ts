import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextFeature, FeatureContextRole } from '../models/ContextFeature.js';
import type { ContextResource } from '../models/ContextResource.js';
import type { ContextRelevance } from '../models/ContextRelevance.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';
import { ContextRelevanceScorer } from './ContextRelevanceScorer.js';
import { ContextPriorityResolver } from '../planning/ContextPriorityResolver.js';
import { ContextDeduplicator } from './ContextDeduplicator.js';

export interface FeatureSelectionResult {
  features: ContextFeature[];
  featureRelevanceMap: Map<string, ContextRelevance>;
}

export class ContextFeatureSelector {
  public static selectFeatures(
    knowledgeMap: Map<string, FeatureKnowledgeResponse>,
    directFeatures: string[],
    resources: ContextResource[],
    request: ContextRequest
  ): FeatureSelectionResult {
    const features: ContextFeature[] = [];
    const featureRelevanceMap = new Map<string, ContextRelevance>();
    const directSet = new Set(directFeatures);

    for (const [featureId, resp] of knowledgeMap.entries()) {
      const isDirect = directSet.has(featureId);
      const role: FeatureContextRole = isDirect ? 'DIRECT' : 'DEPENDENCY';
      const identityData = resp.profile.identity?.data;
      const behavior = resp.profile.behavior?.data;
      const health = resp.profile.health?.data;
      const history = resp.profile.history?.data;

      const relevance = ContextRelevanceScorer.scoreFeature(
        isDirect,
        request.taskText,
        identityData?.name,
        identityData?.description,
        health?.criticalityScore ?? 0.5,
        resp.profile.confidence?.overallScore ?? 1.0
      );

      featureRelevanceMap.set(featureId, relevance);

      const priority = ContextPriorityResolver.resolveFeaturePriority(isDirect, isDirect ? 0 : 1);

      const entryPoints = behavior?.entryPoints ?? [];
      const primaryFlows = behavior?.primaryFlows?.map((f) => f.name) ?? [];
      const risks = health?.risks?.map((r) => `${r.severity}: ${r.description}`) ?? [];
      const recentMilestones = history?.milestones?.map((m) => m.title) ?? [];

      const featureResources = resources.filter((r) => r.featureId === featureId);

      const healthSummary = health
        ? {
            score: health.healthScore,
            status: health.healthStatus,
          }
        : undefined;

      const estimatedTokens = Math.ceil(
        ((identityData?.name?.length ?? 0) +
          (identityData?.description?.length ?? 0) +
          entryPoints.join(' ').length +
          primaryFlows.join(' ').length +
          risks.join(' ').length) /
          4
      );

      features.push({
        featureId,
        name: identityData?.name ?? featureId,
        description: identityData?.description ?? '',
        type: identityData?.type ?? 'UNKNOWN',
        status: identityData?.status ?? 'ACTIVE',
        role,
        relevance,
        priority,
        resources: featureResources,
        entryPoints,
        primaryFlows,
        risks,
        healthSummary,
        recentMilestones,
        estimatedTokens,
      });
    }

    const deduplicated = ContextDeduplicator.deduplicateFeatures(features);

    // Sort by relevance score descending
    deduplicated.sort((a, b) => b.relevance.score - a.relevance.score);

    const bounded =
      request.maxFeatures !== undefined && request.maxFeatures > 0
        ? deduplicated.slice(0, request.maxFeatures)
        : deduplicated;

    return {
      features: bounded,
      featureRelevanceMap,
    };
  }
}
