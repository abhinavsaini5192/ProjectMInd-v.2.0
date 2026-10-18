import type { IAgentContextInvalidator, InvalidationEvaluationResult } from '../interfaces/IAgentContextInvalidator.js';
import type { AgentContextSession } from '../models/AgentContextSession.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { AgentChangeSet } from '../models/AgentChangeSet.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';

export class AgentContextInvalidator implements IAgentContextInvalidator {
  constructor(private readonly featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined) {}

  public async evaluateInvalidation(
    session: AgentContextSession,
    state: AgentContextState,
    changeSet: AgentChangeSet,
    pinnedFeatureIds: readonly string[] = [],
    pinnedResourceIds: readonly string[] = []
  ): Promise<InvalidationEvaluationResult> {
    const allChangedResources = Array.from(
      new Set([
        ...changeSet.modifiedResources,
        ...changeSet.addedResources,
        ...changeSet.deletedResources,
        ...changeSet.renamedResources.map((r) => r.newPath),
        ...changeSet.movedResources.map((r) => r.newPath),
      ])
    );

    if (allChangedResources.length === 0 && changeSet.changedSymbols.length === 0) {
      return {
        decision: 'NO_REFRESH_REQUIRED',
        affectedFeatures: [],
        affectedResources: [],
        staleSections: [],
        reason: 'UNKNOWN',
        summary: 'No modified resources or symbols reported; existing context remains valid.',
      };
    }

    const selectedFeatures = new Set([...state.selectedFeatures, ...pinnedFeatureIds]);
    const selectedResources = new Set([...state.selectedResources, ...pinnedResourceIds]);

    const directlyAffectedResources: string[] = [];
    for (const res of allChangedResources) {
      // Direct path match or normalized path ending match
      const isSelected =
        selectedResources.has(res) ||
        Array.from(selectedResources).some(
          (sel) => sel.endsWith(res) || res.endsWith(sel)
        );
      if (isSelected) {
        directlyAffectedResources.push(res);
      }
    }

    // Impact analysis through Feature Knowledge API if available
    const affectedFeatureSet = new Set<string>();
    let hasDependencyChanges = false;
    let hasBehaviorChanges = false;

    if (this.featureKnowledgeApi && selectedFeatures.size > 0) {
      for (const featureId of selectedFeatures) {
        try {
          const impact = await this.featureKnowledgeApi.getFeatureImpact(featureId);
          // If impact section reports modified resources overlapping our changes
          const affectedFiles = (impact as any)?.affectedFiles ?? [];
          const affectedFeatures = (impact as any)?.affectedFeatures ?? [];

          const hasOverlap = allChangedResources.some(
            (ch) =>
              ch.toLowerCase().includes(featureId.toLowerCase()) ||
              affectedFiles.some((f: string) => f.endsWith(ch) || ch.endsWith(f))
          );

          if (hasOverlap) {
            affectedFeatureSet.add(featureId);
            hasBehaviorChanges = true;

            for (const aff of affectedFeatures) {
              if (selectedFeatures.has(aff)) {
                affectedFeatureSet.add(aff);
                hasDependencyChanges = true;
              }
            }
          }
        } catch {
          // If impact cannot be calculated for feature, assume conservative check
          const featureNameMatch = allChangedResources.some((r) =>
            r.toLowerCase().includes(featureId.toLowerCase())
          );
          if (featureNameMatch) {
            affectedFeatureSet.add(featureId);
          }
        }
      }
    } else {
      // Fallback matching without Feature Knowledge API
      for (const featureId of selectedFeatures) {
        const matches = allChangedResources.some((r) =>
          r.toLowerCase().includes(featureId.toLowerCase())
        );
        if (matches) {
          affectedFeatureSet.add(featureId);
        }
      }
    }

    // Also check if directly affected resources imply feature involvement
    if (directlyAffectedResources.length > 0 && affectedFeatureSet.size === 0) {
      for (const feat of selectedFeatures) {
        affectedFeatureSet.add(feat);
      }
    }

    // Check if changes are completely unrelated to active context
    if (directlyAffectedResources.length === 0 && affectedFeatureSet.size === 0) {
      return {
        decision: 'NO_REFRESH_REQUIRED',
        affectedFeatures: [],
        affectedResources: [],
        staleSections: [],
        reason: 'RESOURCE_CHANGED',
        summary: `Reported changes to ${allChangedResources.length} files do not impact active features or resources in context session '${session.contextSessionId}'.`,
      };
    }

    // Calculate stale sections
    const staleSections: string[] = ['RESOURCES'];
    if (hasBehaviorChanges || changeSet.changedSymbols.length > 0) {
      staleSections.push('BEHAVIOR');
    }
    if (hasDependencyChanges || changeSet.changedApis.length > 0) {
      staleSections.push('DEPENDENCIES');
    }
    staleSections.push('TESTS');

    // Decide between PARTIAL and FULL refresh
    const totalFeaturesCount = selectedFeatures.size;
    const affectedCount = affectedFeatureSet.size;

    let reason: ContextRefreshReason = 'RESOURCE_CHANGED';
    if (changeSet.changedApis.length > 0) {
      reason = 'FEATURE_CHANGED';
    } else if (hasDependencyChanges) {
      reason = 'DEPENDENCY_CHANGED';
    } else if (hasBehaviorChanges) {
      reason = 'BEHAVIOR_CHANGED';
    }

    // If all features and all resources were affected, full refresh is safer
    if (totalFeaturesCount > 0 && affectedCount === totalFeaturesCount && directlyAffectedResources.length >= selectedResources.size) {
      return {
        decision: 'FULL_REFRESH_REQUIRED',
        affectedFeatures: Array.from(affectedFeatureSet),
        affectedResources: directlyAffectedResources,
        staleSections: ['ALL'],
        reason,
        summary: `Widespread changes across all ${totalFeaturesCount} features require full context recalculation.`,
      };
    }

    return {
      decision: 'PARTIAL_REFRESH_REQUIRED',
      affectedFeatures: Array.from(affectedFeatureSet),
      affectedResources: directlyAffectedResources.length > 0 ? directlyAffectedResources : allChangedResources,
      staleSections,
      reason,
      summary: `Changes affect ${affectedFeatureSet.size} feature(s) and ${directlyAffectedResources.length} resource(s); partial refresh required for sections: ${staleSections.join(', ')}.`,
    };
  }
}
