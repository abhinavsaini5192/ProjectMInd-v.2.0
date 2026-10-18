import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextResource } from '../models/ContextResource.js';
import type { ContextRelevance } from '../models/ContextRelevance.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';
import { ContextRelevanceScorer } from './ContextRelevanceScorer.js';
import { ContextPriorityResolver } from '../planning/ContextPriorityResolver.js';
import { ContextDeduplicator } from './ContextDeduplicator.js';

export class ContextResourceSelector {
  public static selectResources(
    knowledgeMap: Map<string, FeatureKnowledgeResponse>,
    featureRelevanceMap: Map<string, ContextRelevance>,
    request: ContextRequest
  ): ContextResource[] {
    const rawResources: ContextResource[] = [];
    const changedSet = new Set(request.changedResources ?? []);

    for (const [featureId, resp] of knowledgeMap.entries()) {
      const parentRelevance = featureRelevanceMap.get(featureId) ?? {
        score: 0.5,
        confidence: 1.0,
        importance: 0.5,
        directness: false,
        reasons: [],
      };

      const mappingData = resp.profile.mappings?.data;
      if (!mappingData || !mappingData.mappings) continue;

      const primarySet = new Set(mappingData.primaryResources ?? []);

      for (const m of mappingData.mappings) {
        if (!m.active) continue;

        const filePath = m.metadata?.['filePath'] ?? m.resourceId;
        const symbolName = m.metadata?.['symbolName'];
        const isChanged = changedSet.has(m.resourceId) || changedSet.has(filePath);
        const isPrimary = primarySet.has(m.resourceId) || m.role?.toUpperCase() === 'PRIMARY';
        const isEntryPoint = m.role?.toUpperCase() === 'ENTRY_POINT';

        const priority = ContextPriorityResolver.resolveResourcePriority(
          isChanged,
          isEntryPoint,
          isPrimary
        );

        const relevance = ContextRelevanceScorer.scoreResource(
          isChanged,
          m.role ?? 'SECONDARY',
          parentRelevance,
          isEntryPoint
        );

        const resource: ContextResource = {
          resourceId: m.resourceId,
          filePath,
          symbolName,
          role: m.role ?? 'SECONDARY',
          featureId,
          relevance,
          priority,
          metadata: m.metadata,
          estimatedTokens: Math.ceil((filePath.length + (m.role?.length ?? 0)) / 4),
        };

        rawResources.push(resource);
      }
    }

    const deduplicated = ContextDeduplicator.deduplicateResources(rawResources);

    // Sort by relevance score descending
    deduplicated.sort((a, b) => b.relevance.score - a.relevance.score);

    if (request.maxResources !== undefined && request.maxResources > 0) {
      return deduplicated.slice(0, request.maxResources);
    }

    return deduplicated;
  }
}
