import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import { isFeatureKnowledgeSection } from '../models/FeatureKnowledgeSection.js';
import { FeatureKnowledgeQueryError } from '../errors/FeatureKnowledgeQueryError.js';

export class FeatureKnowledgeValidator {
  public static validate(query: FeatureKnowledgeQuery): void {
    if (!query || typeof query !== 'object') {
      throw new FeatureKnowledgeQueryError('Query must be a valid object');
    }

    if (typeof query.featureId !== 'string' || query.featureId.trim().length === 0) {
      throw new FeatureKnowledgeQueryError('Feature ID must be a non-empty string', {
        featureId: query.featureId,
      });
    }

    if (query.workspaceId !== undefined && typeof query.workspaceId !== 'string') {
      throw new FeatureKnowledgeQueryError('workspaceId must be a string if provided', {
        workspaceId: query.workspaceId,
      });
    }

    if (query.repositoryId !== undefined && typeof query.repositoryId !== 'string') {
      throw new FeatureKnowledgeQueryError('repositoryId must be a string if provided', {
        repositoryId: query.repositoryId,
      });
    }

    if (query.sections !== undefined) {
      if (!Array.isArray(query.sections)) {
        throw new FeatureKnowledgeQueryError('sections must be an array of FeatureKnowledgeSection', {
          sections: query.sections,
        });
      }

      for (const section of query.sections) {
        if (!isFeatureKnowledgeSection(section)) {
          throw new FeatureKnowledgeQueryError(`Invalid section requested: ${String(section)}`, {
            section,
          });
        }
      }
    }

    if (query.maxDepth !== undefined) {
      if (typeof query.maxDepth !== 'number' || !Number.isInteger(query.maxDepth) || query.maxDepth < 0) {
        throw new FeatureKnowledgeQueryError('maxDepth must be a non-negative integer', {
          maxDepth: query.maxDepth,
        });
      }
    }

    if (query.maxItemsPerSection !== undefined) {
      if (typeof query.maxItemsPerSection !== 'number' || query.maxItemsPerSection <= 0) {
        throw new FeatureKnowledgeQueryError('maxItemsPerSection must be a positive number', {
          maxItemsPerSection: query.maxItemsPerSection,
        });
      }
    }

    if (query.tokenBudget !== undefined) {
      if (typeof query.tokenBudget !== 'number' || query.tokenBudget <= 0) {
        throw new FeatureKnowledgeQueryError('tokenBudget must be a positive number', {
          tokenBudget: query.tokenBudget,
        });
      }
    }

    if (query.freshness !== undefined) {
      const validFreshness = ['CURRENT', 'ALLOW_STALE', 'ANY'];
      if (!validFreshness.includes(query.freshness)) {
        throw new FeatureKnowledgeQueryError(`Invalid freshness policy: ${String(query.freshness)}`, {
          freshness: query.freshness,
        });
      }
    }

    if (query.knowledgeVersion !== undefined && typeof query.knowledgeVersion !== 'string') {
      throw new FeatureKnowledgeQueryError('knowledgeVersion must be a string if provided', {
        knowledgeVersion: query.knowledgeVersion,
      });
    }
  }
}
