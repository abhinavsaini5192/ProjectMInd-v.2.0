import type { IKnowledgeUpdateExecutor } from '../interfaces/IKnowledgeUpdateProcessor.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';
import type { IFeatureMappingEngine } from '../../features/mapping/interfaces/IFeatureMappingEngine.js';
import type { IFeatureDependencyEngine } from '../../features/dependencies/interfaces/IFeatureDependencyEngine.js';
import type { IFeatureBehaviorEngine } from '../../features/behavior/interfaces/IFeatureBehaviorEngine.js';
import type { IFeatureHealthEngine } from '../../features/health/interfaces/IFeatureHealthEngine.js';
import type { IFeatureImpactEngine } from '../../features/impact/interfaces/IFeatureImpactEngine.js';
import type { IFeatureHistoryEngine } from '../../features/history/interfaces/IFeatureHistoryEngine.js';

export interface KnowledgeUpdateExecutorDependencies {
  readonly mappingEngine?: IFeatureMappingEngine | undefined;
  readonly dependencyEngine?: IFeatureDependencyEngine | undefined;
  readonly behaviorEngine?: IFeatureBehaviorEngine | undefined;
  readonly healthEngine?: IFeatureHealthEngine | undefined;
  readonly impactEngine?: IFeatureImpactEngine | undefined;
  readonly historyEngine?: IFeatureHistoryEngine | undefined;
}

export class KnowledgeUpdateExecutor implements IKnowledgeUpdateExecutor {
  constructor(private readonly deps: KnowledgeUpdateExecutorDependencies = {}) {}

  public async executePlan(
    update: KnowledgeUpdate,
    plan: KnowledgeUpdatePlan
  ): Promise<{
    appliedAreas: KnowledgeArea[];
    failedAreas: KnowledgeArea[];
    skippedAreas: KnowledgeArea[];
    errors: string[];
    warnings: string[];
  }> {
    const appliedAreas = new Set<KnowledgeArea>();
    const failedAreas = new Set<KnowledgeArea>();
    const skippedAreas = new Set<KnowledgeArea>(plan.skippedAreas);
    const errors: string[] = [];
    const warnings: string[] = [...plan.warnings];

    const targetResources = [...plan.targetResources];
    const targetFeatures = [...plan.targetFeatures];

    // 1. Mapping Stage
    if (plan.targetKnowledgeAreas.includes('FEATURE_MAPPING')) {
      if (this.deps.mappingEngine && targetResources.length > 0) {
        try {
          await this.deps.mappingEngine.mapIncremental(targetResources);
          appliedAreas.add('FEATURE_MAPPING');
        } catch (err: any) {
          failedAreas.add('FEATURE_MAPPING');
          errors.push(`FeatureMapping update failed: ${err.message || String(err)}`);
        }
      } else {
        appliedAreas.add('FEATURE_MAPPING');
      }
    }

    // 2. Dependency Stage
    if (plan.targetKnowledgeAreas.includes('FEATURE_DEPENDENCIES')) {
      if (this.deps.dependencyEngine && targetResources.length > 0) {
        try {
          await this.deps.dependencyEngine.updateIncremental(targetResources);
          appliedAreas.add('FEATURE_DEPENDENCIES');
        } catch (err: any) {
          failedAreas.add('FEATURE_DEPENDENCIES');
          errors.push(`FeatureDependency update failed: ${err.message || String(err)}`);
        }
      } else {
        appliedAreas.add('FEATURE_DEPENDENCIES');
      }
    }

    // 3. Behavior Stage
    if (plan.targetKnowledgeAreas.includes('FEATURE_BEHAVIOR')) {
      if (this.deps.behaviorEngine && targetResources.length > 0) {
        try {
          const context: any = {
            workspaceId: update.workspaceId || 'default',
            repositoryId: update.repositoryId,
            featureIds: targetFeatures,
          };
          await this.deps.behaviorEngine.analyzeIncremental(targetResources, context);
          appliedAreas.add('FEATURE_BEHAVIOR');
        } catch (err: any) {
          failedAreas.add('FEATURE_BEHAVIOR');
          errors.push(`FeatureBehavior update failed: ${err.message || String(err)}`);
        }
      } else {
        appliedAreas.add('FEATURE_BEHAVIOR');
      }
    }

    // 4. Health & Risk Stage
    if (plan.targetKnowledgeAreas.includes('FEATURE_HEALTH')) {
      if (this.deps.healthEngine && targetFeatures.length > 0) {
        try {
          await this.deps.healthEngine.analyzeIncremental(targetFeatures);
          appliedAreas.add('FEATURE_HEALTH');
          appliedAreas.add('FEATURE_RISK');
        } catch (err: any) {
          failedAreas.add('FEATURE_HEALTH');
          errors.push(`FeatureHealth update failed: ${err.message || String(err)}`);
        }
      } else {
        appliedAreas.add('FEATURE_HEALTH');
      }
    }

    // 5. Impact Stage
    if (plan.targetKnowledgeAreas.includes('FEATURE_IMPACT')) {
      if (this.deps.impactEngine && targetResources.length > 0) {
        try {
          const changes: any[] = targetResources.map((res) => ({
            changeId: `ch_${res}`,
            resourceId: res,
            changeType: update.updateType,
            timestamp: Date.now(),
          }));
          await this.deps.impactEngine.analyzeIncremental(changes);
          appliedAreas.add('FEATURE_IMPACT');
        } catch (err: any) {
          failedAreas.add('FEATURE_IMPACT');
          errors.push(`FeatureImpact update failed: ${err.message || String(err)}`);
        }
      } else {
        appliedAreas.add('FEATURE_IMPACT');
      }
    }

    // 6. History Stage
    if (plan.targetKnowledgeAreas.includes('FEATURE_HISTORY')) {
      if (this.deps.historyEngine && targetFeatures.length > 0) {
        try {
          const historyEvents: any[] = targetFeatures.map((fId) => ({
            eventId: `evt_${fId}_${Date.now()}`,
            featureId: fId,
            eventType: update.updateType,
            description: `Knowledge update applied for ${fId} (${update.updateType})`,
            timestamp: Date.now(),
            confidence: update.confidence,
          }));
          await this.deps.historyEngine.updateIncremental(historyEvents);
          appliedAreas.add('FEATURE_HISTORY');
        } catch (err: any) {
          failedAreas.add('FEATURE_HISTORY');
          errors.push(`FeatureHistory update failed: ${err.message || String(err)}`);
        }
      } else {
        appliedAreas.add('FEATURE_HISTORY');
      }
    }

    // 7. Resource metadata & Symbol knowledge
    if (plan.targetKnowledgeAreas.includes('RESOURCE_METADATA')) {
      appliedAreas.add('RESOURCE_METADATA');
    }
    if (plan.targetKnowledgeAreas.includes('SYMBOL_KNOWLEDGE')) {
      appliedAreas.add('SYMBOL_KNOWLEDGE');
    }
    if (plan.targetKnowledgeAreas.includes('VERIFICATION')) {
      appliedAreas.add('VERIFICATION');
    }

    return {
      appliedAreas: Array.from(appliedAreas).sort(),
      failedAreas: Array.from(failedAreas).sort(),
      skippedAreas: Array.from(skippedAreas).sort(),
      errors,
      warnings,
    };
  }
}
