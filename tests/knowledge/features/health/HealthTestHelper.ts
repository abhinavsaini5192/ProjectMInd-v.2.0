import { createDefaultFeature } from '../../../../src/knowledge/features/models/Feature.js';
import type { Feature } from '../../../../src/knowledge/features/models/Feature.js';
import type { FeatureResourceMapping } from '../../../../src/knowledge/features/mapping/models/FeatureResourceMapping.js';
import type { MappingResourceType } from '../../../../src/knowledge/features/mapping/models/MappingResourceType.js';
import type { MappingRole } from '../../../../src/knowledge/features/mapping/models/MappingRole.js';
import type { FeatureDependency } from '../../../../src/knowledge/features/dependencies/models/FeatureDependency.js';
import type { FeatureDependencyCycle } from '../../../../src/knowledge/features/dependencies/models/FeatureDependencyCycle.js';
import type { FeatureBehaviorResult } from '../../../../src/knowledge/features/behavior/models/FeatureBehaviorResult.js';
import type { FeatureFlow } from '../../../../src/knowledge/features/behavior/models/FeatureFlow.js';
import type { FeatureFlowType } from '../../../../src/knowledge/features/behavior/models/FeatureFlowType.js';
import type { HealthContext } from '../../../../src/knowledge/features/health/interfaces/IFeatureHealthSignal.js';
import { FeatureHealthRepository } from '../../../../src/knowledge/features/health/repository/FeatureHealthRepository.js';
import { FeatureHealthEngine } from '../../../../src/knowledge/features/health/core/FeatureHealthEngine.js';

export class HealthTestHelper {
  public static createFeature(
    id: string,
    name: string,
    options?: {
      description?: string;
      type?: any;
      confidence?: any;
      metadata?: Record<string, unknown>;
    }
  ): Feature {
    const f = createDefaultFeature(
      id,
      name,
      { workspaceId: 'ws_test', repositoryId: 'repo_test' },
      {
        description: options?.description || `Description for ${name}`,
        type: options?.type || 'BUSINESS_CAPABILITY'
      }
    );
    (f as any).featureId = id;
    if (options?.confidence) {
      f.confidence = options.confidence;
    }
    if (options?.metadata) {
      f.metadata = { ...f.metadata, ...options.metadata };
    }
    return f;
  }

  public static createMapping(
    featureId: string,
    resourceId: string,
    resourceType: MappingResourceType = 'FILE',
    role: MappingRole = 'IMPLEMENTATION',
    metadata: Record<string, unknown> = {}
  ): FeatureResourceMapping {
    return {
      mappingId: `map_${featureId}_${resourceId.replace(/[^a-zA-Z0-9]/g, '_')}`,
      featureId,
      resourceId,
      resourceType,
      role,
      confidence: 'HIGH',
      score: 0.9,
      evidence: [],
      source: 'AST_STRUCTURE',
      scope: { workspaceId: 'ws_test', repositoryId: 'repo_test' },
      active: true,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      knowledgeVersion: '6.6.0',
      mappingVersion: 1
    } as unknown as FeatureResourceMapping;
  }

  public static createDependency(
    dependentFeatureId: string,
    providerFeatureId: string,
    strength: number = 0.5
  ): FeatureDependency {
    return {
      dependencyId: `dep_${dependentFeatureId}_${providerFeatureId}`,
      dependentFeatureId,
      providerFeatureId,
      type: 'DEPENDS_ON',
      strength,
      confidence: { level: 'HIGH', score: 0.8, reasons: ['Test dependency'] },
      isDirect: true,
      evidenceCount: 2
    };
  }

  public static createCycle(path: string[]): FeatureDependencyCycle {
    return {
      cycleId: `cycle_${path.join('_')}`,
      features: path,
      cyclePath: path,
      length: path.length,
      relationships: [],
      confidence: 0.9,
      evidence: [],
      classification: 'VALIDATED_CYCLE',
      createdAt: Date.now()
    };
  }

  public static createFlow(
    featureId: string,
    flowId: string,
    name: string,
    flowType: FeatureFlowType = 'PRIMARY',
    stepCount: number = 3,
    options?: { isVerified?: boolean; hasErrorStep?: boolean; isUnterminated?: boolean }
  ): FeatureFlow {
    const steps = [];
    for (let i = 0; i < stepCount; i++) {
      steps.push({
        stepId: `step_${flowId}_${i}`,
        sequenceOrder: i + 1,
        name: `Step ${i + 1}`,
        description: i === stepCount - 1 && options?.hasErrorStep ? 'Error catch and recovery' : `Executing action ${i + 1}`,
        stepType: i === stepCount - 1 && options?.hasErrorStep ? ('ERROR_HANDLING' as const) : ('PROCESSING' as const),
        confidence: 0.9,
        evidence: []
      });
    }

    return {
      flowId,
      featureId,
      name,
      description: `Flow ${name}`,
      flowType,
      confidence: 0.9,
      steps,
      nodes: [],
      edges: [],
      metadata: {
        isVerified: options?.isVerified ?? true,
        isUnterminated: options?.isUnterminated ?? false
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as unknown as FeatureFlow;
  }

  public static createBehaviorResult(featureId: string, flows: FeatureFlow[]): FeatureBehaviorResult {
    const behavior = {
      behaviorId: `beh_${featureId}`,
      featureId,
      flows,
      summary: { flowCount: flows.length, complexityScore: 20 },
      scope: { workspaceId: 'ws_test', repositoryId: 'repo_test' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      active: true
    } as any;
    return {
      runId: `run_${Date.now()}`,
      featureId,
      flows,
      behaviors: [behavior],
      newBehaviors: [behavior],
      updatedBehaviors: [],
      staleBehaviors: [],
      conflicts: [],
      statistics: {
        flowsEvaluated: flows.length,
        nodesCreated: 0,
        edgesCreated: 0,
        conflictsDetected: 0,
        featuresAnalyzed: 1,
        pathsComputed: 0,
      },
      behavior,
      candidates: [],
      paths: [],
      summary: {
        flowCount: flows.length,
        stepCount: flows.reduce((acc, f) => acc + (f.steps?.length ?? 0), 0),
        nodeCount: 0,
        edgeCount: 0,
        conflictCount: 0,
        candidateCount: 0,
        averageConfidence: 0.9
      }
    };
  }

  public static createContext(params: {
    feature: Feature;
    mappings?: FeatureResourceMapping[];
    dependencies?: FeatureDependency[];
    dependents?: FeatureDependency[];
    cycles?: FeatureDependencyCycle[];
    flows?: FeatureFlow[];
    allFeatures?: Feature[];
    allMappings?: FeatureResourceMapping[];
  }): HealthContext {
    const behavior = params.flows ? this.createBehaviorResult(params.feature.featureId, params.flows) : undefined;
    return {
      feature: params.feature,
      mappings: params.mappings || [],
      dependencies: params.dependencies || [],
      dependents: params.dependents || [],
      cycles: params.cycles || [],
      behavior,
      allFeatures: params.allFeatures || [params.feature],
      allMappings: params.allMappings || params.mappings || []
    };
  }

  public static createEngine(repo?: FeatureHealthRepository): {
    engine: FeatureHealthEngine;
    repository: FeatureHealthRepository;
  } {
    const repository = repo || new FeatureHealthRepository();
    const engine = new FeatureHealthEngine(repository);
    return { engine, repository };
  }
}
