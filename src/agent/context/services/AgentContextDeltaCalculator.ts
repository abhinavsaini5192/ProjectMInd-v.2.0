import type { IAgentContextDeltaCalculator } from '../interfaces/IAgentContextDeltaCalculator.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { ContextDelta, ContextDeltaItem } from '../models/ContextDelta.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';
import {
  ContextVersionConflictError,
  ContextDeltaInvalidError,
} from '../errors/AgentContextError.js';

export class AgentContextDeltaCalculator implements IAgentContextDeltaCalculator {
  public computeDelta(
    previousPackage: ContextPackage,
    nextPackage: ContextPackage,
    reason: ContextRefreshReason,
    contextSessionId: string,
    baseVersion: number,
    targetVersion: number
  ): ContextDelta {
    const added: ContextDeltaItem[] = [];
    const removed: ContextDeltaItem[] = [];
    const changed: ContextDeltaItem[] = [];
    const stale: ContextDeltaItem[] = [];
    const unchanged: ContextDeltaItem[] = [];

    // 1. Compare Features
    const prevFeatures = new Map(previousPackage.features.map((f) => [f.featureId, f]));
    const nextFeatures = new Map(nextPackage.features.map((f) => [f.featureId, f]));

    for (const [id, nextFeat] of nextFeatures.entries()) {
      const prevFeat = prevFeatures.get(id);
      if (!prevFeat) {
        added.push({
          id,
          type: 'FEATURE',
          description: `Feature '${nextFeat.name}' added to context`,
          data: { name: nextFeat.name, primaryRole: nextFeat.primaryRole },
        });
      } else if (
        JSON.stringify(prevFeat.entryPoints) !== JSON.stringify(nextFeat.entryPoints) ||
        JSON.stringify(prevFeat.components) !== JSON.stringify(nextFeat.components)
      ) {
        changed.push({
          id,
          type: 'FEATURE',
          description: `Feature '${nextFeat.name}' updated in context`,
          data: { name: nextFeat.name },
        });
      } else {
        unchanged.push({
          id,
          type: 'FEATURE',
          description: `Feature '${nextFeat.name}' unchanged`,
        });
      }
    }

    for (const [id, prevFeat] of prevFeatures.entries()) {
      if (!nextFeatures.has(id)) {
        removed.push({
          id,
          type: 'FEATURE',
          description: `Feature '${prevFeat.name}' removed from context`,
        });
      }
    }

    // 2. Compare Resources
    const prevResources = new Map(previousPackage.resources.map((r) => [r.resourceId, r]));
    const nextResources = new Map(nextPackage.resources.map((r) => [r.resourceId, r]));

    for (const [id, nextRes] of nextResources.entries()) {
      const prevRes = prevResources.get(id);
      if (!prevRes) {
        added.push({
          id,
          type: 'RESOURCE',
          description: `Resource '${nextRes.path}' added to context`,
          data: { path: nextRes.path, tokenCount: nextRes.tokenCount },
        });
      } else if (
        prevRes.contentHash !== nextRes.contentHash ||
        prevRes.content !== nextRes.content ||
        prevRes.tokenCount !== nextRes.tokenCount
      ) {
        changed.push({
          id,
          type: 'RESOURCE',
          description: `Resource '${nextRes.path}' modified in context`,
          data: { path: nextRes.path, tokenCount: nextRes.tokenCount },
        });
      } else {
        unchanged.push({
          id,
          type: 'RESOURCE',
          description: `Resource '${nextRes.path}' unchanged`,
        });
      }
    }

    for (const [id, prevRes] of prevResources.entries()) {
      if (!nextResources.has(id)) {
        removed.push({
          id,
          type: 'RESOURCE',
          description: `Resource '${prevRes.path}' removed from context`,
        });
      }
    }

    // 3. Compare Behavior & Tests sections
    if (nextPackage.behavior && previousPackage.behavior) {
      if (JSON.stringify(nextPackage.behavior) !== JSON.stringify(previousPackage.behavior)) {
        changed.push({
          id: 'section_behavior',
          type: 'BEHAVIOR',
          description: 'Behavioral flows updated in context',
        });
      }
    }

    if (nextPackage.tests && previousPackage.tests) {
      if (JSON.stringify(nextPackage.tests) !== JSON.stringify(previousPackage.tests)) {
        changed.push({
          id: 'section_tests',
          type: 'TEST',
          description: 'Test mappings updated in context',
        });
      }
    }

    // 4. Compare Health
    if (nextPackage.health && previousPackage.health) {
      if (JSON.stringify(nextPackage.health) !== JSON.stringify(previousPackage.health)) {
        changed.push({
          id: 'section_health',
          type: 'HEALTH',
          description: 'Health metrics updated in context',
        });
      }
    }

    const deltaId = `delta_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      deltaId,
      contextSessionId,
      baseContextVersion: baseVersion,
      targetContextVersion: targetVersion,
      added,
      removed,
      changed,
      stale,
      unchanged,
      reason,
      createdAt: new Date(),
    };
  }

  public validateDeltaSafety(
    delta: ContextDelta,
    currentVersion: number,
    repositoryId: string,
    expectedRepositoryId: string
  ): void {
    if (repositoryId !== expectedRepositoryId) {
      throw new ContextDeltaInvalidError(
        delta.contextSessionId,
        `Repository scope mismatch: delta is for repository '${repositoryId}', but session belongs to '${expectedRepositoryId}'`
      );
    }

    if (delta.baseContextVersion !== currentVersion) {
      throw new ContextVersionConflictError(
        delta.contextSessionId,
        delta.baseContextVersion,
        currentVersion
      );
    }

    if (delta.targetContextVersion <= delta.baseContextVersion) {
      throw new ContextDeltaInvalidError(
        delta.contextSessionId,
        `Target context version (${delta.targetContextVersion}) must be greater than base context version (${delta.baseContextVersion})`
      );
    }
  }
}
