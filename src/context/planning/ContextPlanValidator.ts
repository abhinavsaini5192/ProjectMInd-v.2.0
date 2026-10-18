import type { ContextRequest } from '../models/ContextRequest.js';
import { isContextFormat } from '../models/ContextFormat.js';
import { isContextSection } from '../models/ContextSection.js';
import { ContextPlanningError } from '../errors/ContextPlanningError.js';

export class ContextPlanValidator {
  public static validate(request: ContextRequest, resolvedFeatureIds: string[] = []): void {
    if (!request) {
      throw new ContextPlanningError('Context request cannot be null or undefined');
    }

    if (!request.repositoryId || typeof request.repositoryId !== 'string' || request.repositoryId.trim().length === 0) {
      throw new ContextPlanningError('repositoryId is required for context planning', { request });
    }

    if (!request.workspaceId || typeof request.workspaceId !== 'string' || request.workspaceId.trim().length === 0) {
      throw new ContextPlanningError('workspaceId is required for context planning', { request });
    }

    if (request.tokenBudget !== undefined) {
      if (typeof request.tokenBudget !== 'number' || isNaN(request.tokenBudget) || request.tokenBudget <= 0) {
        throw new ContextPlanningError(`tokenBudget must be a positive number, got: ${request.tokenBudget}`, { request });
      }
    }

    if (request.maxDepth !== undefined) {
      if (typeof request.maxDepth !== 'number' || isNaN(request.maxDepth) || request.maxDepth < 0) {
        throw new ContextPlanningError(`maxDepth must be a non-negative number, got: ${request.maxDepth}`, { request });
      }
    }

    if (request.maxFeatures !== undefined) {
      if (typeof request.maxFeatures !== 'number' || isNaN(request.maxFeatures) || request.maxFeatures < 0) {
        throw new ContextPlanningError(`maxFeatures must be a non-negative number, got: ${request.maxFeatures}`, { request });
      }
    }

    if (request.maxResources !== undefined) {
      if (typeof request.maxResources !== 'number' || isNaN(request.maxResources) || request.maxResources < 0) {
        throw new ContextPlanningError(`maxResources must be a non-negative number, got: ${request.maxResources}`, { request });
      }
    }

    if (request.outputFormat !== undefined && !isContextFormat(request.outputFormat)) {
      throw new ContextPlanningError(`Invalid output format: ${request.outputFormat}`, { request });
    }

    if (request.freshnessPolicy !== undefined) {
      const validPolicies = ['CURRENT', 'ALLOW_STALE', 'ANY'];
      if (!validPolicies.includes(request.freshnessPolicy)) {
        throw new ContextPlanningError(`Invalid freshness policy: ${request.freshnessPolicy}`, { request });
      }
    }

    if (request.requestedSections) {
      for (const section of request.requestedSections) {
        if (!isContextSection(section)) {
          throw new ContextPlanningError(`Invalid requested section: ${section}`, { request });
        }
      }
    }

    const hasTargetFeatures = (request.featureIds && request.featureIds.length > 0) || resolvedFeatureIds.length > 0;
    const hasChangedResources = request.changedResources && request.changedResources.length > 0;
    const hasTaskText = typeof request.taskText === 'string' && request.taskText.trim().length > 0;
    const hasTaskIntent = request.taskIntent && Object.keys(request.taskIntent).length > 0;
    const hasResourceIds = request.resourceIds && request.resourceIds.length > 0;

    if (!hasTargetFeatures && !hasChangedResources && !hasTaskText && !hasTaskIntent && !hasResourceIds) {
      throw new ContextPlanningError(
        'Context request must contain at least one of: featureIds, resolvedFeatureIds, changedResources, resourceIds, taskText, or taskIntent',
        { request }
      );
    }
  }
}
