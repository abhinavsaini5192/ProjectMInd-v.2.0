import type { IKnowledgeImpactResolver } from '../interfaces/IKnowledgeImpactResolver.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdateImpact } from '../models/KnowledgeUpdateImpact.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';
import type { IFeatureMappingEngine } from '../../features/mapping/interfaces/IFeatureMappingEngine.js';
import type { IFeatureDependencyEngine } from '../../features/dependencies/interfaces/IFeatureDependencyEngine.js';
import type { IFeatureRegistry } from '../../features/interfaces/IFeatureRegistry.js';

export interface KnowledgeImpactResolverDependencies {
  readonly mappingEngine?: IFeatureMappingEngine | undefined;
  readonly dependencyEngine?: IFeatureDependencyEngine | undefined;
  readonly featureRegistry?: IFeatureRegistry | undefined;
}

export class KnowledgeImpactResolver implements IKnowledgeImpactResolver {
  constructor(private readonly deps: KnowledgeImpactResolverDependencies = {}) {}

  public async resolveImpact(update: KnowledgeUpdate): Promise<KnowledgeUpdateImpact> {
    const directlyAffected = new Set<string>(update.affectedFeatures);
    const downstreamAffected = new Set<string>();
    const dependencyPaths: string[][] = [];

    // 1. Resolve resources to features
    for (const resourceId of update.affectedResources) {
      // Check via mapping engine if available
      if (this.deps.mappingEngine) {
        try {
          const features = await this.deps.mappingEngine.getResourceFeatures(resourceId);
          for (const f of features) directlyAffected.add(f);
        } catch {
          // Ignore mapping engine errors
        }
      }

      // Check via feature registry references
      if (this.deps.featureRegistry) {
        try {
          const features = await this.deps.featureRegistry.findByReference(resourceId);
          for (const f of features) directlyAffected.add(f.id);
        } catch {
          // Ignore registry lookup errors
        }
      }

      // Heuristic fallback matching for common feature path patterns (e.g. src/auth/ -> auth)
      for (const featId of update.affectedFeatures) {
        if (resourceId.toLowerCase().includes(featId.toLowerCase())) {
          directlyAffected.add(featId);
        }
      }
    }

    // 2. Resolve downstream dependents via dependency engine
    if (this.deps.dependencyEngine && directlyAffected.size > 0) {
      for (const featureId of directlyAffected) {
        try {
          const dependents = await this.deps.dependencyEngine.getDependents(featureId);
          for (const dep of dependents) {
            if (!directlyAffected.has(dep.id)) {
              downstreamAffected.add(dep.id);
              dependencyPaths.push([featureId, dep.id]);
            }
          }
        } catch {
          // Ignore dependency lookup failure
        }
      }
    }

    // 3. Determine affected knowledge areas
    const affectedAreas = new Set<KnowledgeArea>(update.affectedKnowledgeAreas);

    if (update.updateType === 'SYMBOL_CHANGED' || update.updateType === 'API_CHANGED') {
      affectedAreas.add('FEATURE_BEHAVIOR');
      affectedAreas.add('FEATURE_MAPPING');
    }
    if (update.updateType === 'DEPENDENCY_CHANGED') {
      affectedAreas.add('FEATURE_DEPENDENCIES');
      affectedAreas.add('FEATURE_IMPACT');
    }
    if (update.updateType === 'VERIFICATION_CHANGED') {
      affectedAreas.add('FEATURE_HEALTH');
      affectedAreas.add('FEATURE_RISK');
      affectedAreas.add('FEATURE_HISTORY');
    }
    if (directlyAffected.size > 0) {
      affectedAreas.add('FEATURE_MAPPING');
      affectedAreas.add('FEATURE_HEALTH');
      affectedAreas.add('FEATURE_HISTORY');
    }

    return {
      resourceId: update.affectedResources[0],
      featureId: update.affectedFeatures[0],
      directlyAffectedFeatures: Array.from(directlyAffected).sort(),
      downstreamAffectedFeatures: Array.from(downstreamAffected).sort(),
      affectedKnowledgeAreas: Array.from(affectedAreas).sort(),
      dependencyPaths,
      confidence: update.confidence,
      reason: `Impact resolved from ${update.affectedResources.length} resources and ${directlyAffected.size} direct features.`,
    };
  }

  public async resolveBatchImpact(updates: readonly KnowledgeUpdate[]): Promise<KnowledgeUpdateImpact> {
    const directlyAffected = new Set<string>();
    const downstreamAffected = new Set<string>();
    const affectedAreas = new Set<KnowledgeArea>();
    const dependencyPaths: string[][] = [];

    for (const update of updates) {
      const impact = await this.resolveImpact(update);
      for (const f of impact.directlyAffectedFeatures) directlyAffected.add(f);
      for (const f of impact.downstreamAffectedFeatures) downstreamAffected.add(f);
      for (const a of impact.affectedKnowledgeAreas) affectedAreas.add(a);
      for (const p of impact.dependencyPaths) dependencyPaths.push([...p]);
    }

    return {
      directlyAffectedFeatures: Array.from(directlyAffected).sort(),
      downstreamAffectedFeatures: Array.from(downstreamAffected).sort(),
      affectedKnowledgeAreas: Array.from(affectedAreas).sort(),
      dependencyPaths,
      confidence: 0.9,
      reason: `Aggregated impact across ${updates.length} updates.`,
    };
  }
}
