import type { IFeatureHealthCoordinator, HealthContextOptions } from '../interfaces/IFeatureHealthCoordinator.js';
import type { HealthContext } from '../interfaces/IFeatureHealthSignal.js';
import type { IFeatureRepository } from '../../interfaces/IFeatureRepository.js';
import type { IFeatureMappingRepository } from '../../mapping/interfaces/IFeatureMappingRepository.js';
import type { IFeatureDependencyEngine } from '../../dependencies/interfaces/IFeatureDependencyEngine.js';
import type { IFeatureBehaviorRepository } from '../../behavior/interfaces/IFeatureBehaviorRepository.js';
import type { Feature } from '../../models/Feature.js';
import type { FeatureResourceMapping } from '../../mapping/models/FeatureResourceMapping.js';
import type { FeatureDependency } from '../../dependencies/models/FeatureDependency.js';
import type { FeatureDependencyCycle } from '../../dependencies/models/FeatureDependencyCycle.js';
import type { FeatureBehaviorResult } from '../../behavior/models/FeatureBehaviorResult.js';
import { InvalidHealthReferenceError } from '../errors/InvalidHealthReferenceError.js';

export class FeatureHealthCoordinator implements IFeatureHealthCoordinator {
  private featureRepository?: IFeatureRepository;
  private mappingRepository?: IFeatureMappingRepository;
  private dependencyEngine?: IFeatureDependencyEngine;
  private behaviorRepository?: IFeatureBehaviorRepository;

  constructor(dependencies?: {
    featureRepository?: IFeatureRepository;
    mappingRepository?: IFeatureMappingRepository;
    dependencyEngine?: IFeatureDependencyEngine;
    behaviorRepository?: IFeatureBehaviorRepository;
  }) {
    this.featureRepository = dependencies?.featureRepository;
    this.mappingRepository = dependencies?.mappingRepository;
    this.dependencyEngine = dependencies?.dependencyEngine;
    this.behaviorRepository = dependencies?.behaviorRepository;
  }

  public async buildContext(featureId: string, options?: HealthContextOptions): Promise<HealthContext> {
    let feature: Feature | null = null;
    if (this.featureRepository) {
      feature = await this.featureRepository.get(featureId);
    }

    if (!feature) {
      throw new InvalidHealthReferenceError('Feature', featureId);
    }

    let mappings: FeatureResourceMapping[] = [];
    if (this.mappingRepository) {
      mappings = await this.mappingRepository.getMappings(featureId);
    }

    let dependencies: FeatureDependency[] = [];
    let dependents: FeatureDependency[] = [];
    let cycles: FeatureDependencyCycle[] = [];

    if (this.dependencyEngine) {
      try {
        const rels = await this.dependencyEngine.getRelationships(featureId);
        dependencies = rels
          .filter((r) => r.sourceFeatureId === featureId)
          .map((r) => ({
            dependencyId: r.relationshipId,
            dependentFeatureId: r.sourceFeatureId,
            providerFeatureId: r.targetFeatureId,
            type: r.relationshipType || r.type || 'DEPENDS_ON',
            strength: r.strength ?? r.score ?? 1.0,
            confidence: r.confidence,
            isDirect: true,
            evidenceCount: r.evidence?.length ?? 1
          }));

        dependents = rels
          .filter((r) => r.targetFeatureId === featureId)
          .map((r) => ({
            dependencyId: r.relationshipId,
            dependentFeatureId: r.sourceFeatureId,
            providerFeatureId: r.targetFeatureId,
            type: r.relationshipType || r.type || 'DEPENDS_ON',
            strength: r.strength ?? r.score ?? 1.0,
            confidence: r.confidence,
            isDirect: true,
            evidenceCount: r.evidence?.length ?? 1
          }));

        cycles = await this.dependencyEngine.detectCycles();
      } catch (err) {
        console.warn(`[FeatureHealthCoordinator] Dependency query error for ${featureId}:`, err);
      }
    }

    let behavior: FeatureBehaviorResult | undefined = undefined;
    if (this.behaviorRepository) {
      try {
        const fBehavior = await this.behaviorRepository.getBehavior(featureId);
        if (fBehavior) {
          behavior = {
            runId: `run_${Date.now()}`,
            featureId,
            flows: fBehavior.flows,
            behavior: fBehavior,
            behaviors: [],
            newBehaviors: [],
            updatedBehaviors: [],
            staleBehaviors: [],
            candidates: [],
            conflicts: [],
            paths: [],
            statistics: {
              flowsEvaluated: fBehavior.flows.length,
              nodesCreated: fBehavior.flows.reduce((acc, f) => acc + (f.nodes?.length ?? 0), 0),
              edgesCreated: fBehavior.flows.reduce((acc, f) => acc + (f.edges?.length ?? 0), 0),
              conflictsDetected: 0,
              featuresAnalyzed: 1,
              pathsComputed: 0,
            },
            summary: {
              flowCount: fBehavior.flows.length,
              stepCount: fBehavior.flows.reduce((acc, f) => acc + (f.steps?.length ?? 0), 0),
              nodeCount: fBehavior.flows.reduce((acc, f) => acc + (f.nodes?.length ?? 0), 0),
              edgeCount: fBehavior.flows.reduce((acc, f) => acc + (f.edges?.length ?? 0), 0),
              conflictCount: 0,
              candidateCount: 0,
              averageConfidence: 0.9
            }
          };
        }
      } catch (err) {
        console.warn(`[FeatureHealthCoordinator] Behavior query error for ${featureId}:`, err);
      }
    }

    let allFeatures: Feature[] = [];
    if (this.featureRepository) {
      try {
        allFeatures = await this.featureRepository.list();
      } catch {
        allFeatures = [];
      }
    }

    let allMappings: FeatureResourceMapping[] = [];
    if (this.mappingRepository) {
      try {
        allMappings = await this.mappingRepository.getAll();
      } catch {
        allMappings = [];
      }
    }

    return {
      feature,
      mappings,
      dependencies,
      dependents,
      cycles,
      behavior,
      allFeatures,
      allMappings,
      metadata: {
        includeIndirectDependencies: options?.includeIndirectDependencies ?? false,
        includeFlows: options?.includeFlows ?? true
      }
    };
  }

  public async buildAllContexts(workspaceId: string, repositoryId: string): Promise<HealthContext[]> {
    if (!this.featureRepository) {
      return [];
    }

    const features = await this.featureRepository.list(repositoryId);
    const contexts: HealthContext[] = [];

    for (const feature of features) {
      try {
        const ctx = await this.buildContext(feature.featureId);
        contexts.push(ctx);
      } catch (err) {
        console.warn(`[FeatureHealthCoordinator] Skipping feature ${feature.featureId}:`, err);
      }
    }

    return contexts;
  }
}
