import type {
  IFeatureKnowledgeResolver,
  ResolvedRawSections,
} from '../interfaces/IFeatureKnowledgeResolver.js';
import type { FeatureKnowledgeExecutionPlan } from '../interfaces/IFeatureKnowledgePlanner.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureIdentitySection } from '../sections/FeatureIdentitySection.js';
import type { FeatureMappingSection, MappedResourceItem } from '../sections/FeatureMappingSection.js';
import type { FeatureDependencySection, DependencyItem } from '../sections/FeatureDependencySection.js';
import type { FeatureBehaviorSection, BehaviorFlowItem } from '../sections/FeatureBehaviorSection.js';
import type { FeatureHealthSection, RiskItem } from '../sections/FeatureHealthSection.js';
import type { FeatureImpactSection, ImpactedTargetItem } from '../sections/FeatureImpactSection.js';
import type { FeatureHistorySection, MilestoneItem, TrendItem } from '../sections/FeatureHistorySection.js';
import type { FeatureArchitectureSection } from '../sections/FeatureArchitectureSection.js';

import type { IFeatureRepository } from '../../interfaces/IFeatureRepository.js';
import type { IFeatureMappingRepository } from '../../mapping/interfaces/IFeatureMappingRepository.js';
import type { IFeatureRelationshipRepository } from '../../dependencies/interfaces/IFeatureRelationshipRepository.js';
import type { IFeatureBehaviorRepository } from '../../behavior/interfaces/IFeatureBehaviorRepository.js';
import type { IFeatureHealthRepository } from '../../health/interfaces/IFeatureHealthRepository.js';
import type { IImpactRepository } from '../../impact/interfaces/IImpactRepository.js';
import type { IFeatureHistoryRepository } from '../../history/interfaces/IFeatureHistoryRepository.js';

import { FeatureKnowledgeNotFoundError } from '../errors/FeatureKnowledgeNotFoundError.js';
import { FeatureKnowledgeAccessError } from '../errors/FeatureKnowledgeAccessError.js';

export interface FeatureKnowledgeResolverDependencies {
  featureRepository: IFeatureRepository;
  mappingRepository?: IFeatureMappingRepository | undefined;
  relationshipRepository?: IFeatureRelationshipRepository | undefined;
  behaviorRepository?: IFeatureBehaviorRepository | undefined;
  healthRepository?: IFeatureHealthRepository | undefined;
  impactRepository?: IImpactRepository | undefined;
  historyRepository?: IFeatureHistoryRepository | undefined;
}

export class FeatureKnowledgeResolver implements IFeatureKnowledgeResolver {
  constructor(private readonly deps: FeatureKnowledgeResolverDependencies) {}

  public async resolveSections(
    plan: FeatureKnowledgeExecutionPlan,
    query: FeatureKnowledgeQuery
  ): Promise<ResolvedRawSections> {
    // 1. Resolve Identity
    const feature = await this.deps.featureRepository.get(plan.featureId as any);
    if (!feature) {
      throw new FeatureKnowledgeNotFoundError(plan.featureId);
    }

    // Check scope isolation
    const featObj = feature as any;
    if (query.workspaceId && featObj.workspaceId && featObj.workspaceId !== query.workspaceId) {
      throw new FeatureKnowledgeAccessError(
        `Feature '${plan.featureId}' does not belong to workspace '${query.workspaceId}'`,
        { featureId: plan.featureId, workspaceId: query.workspaceId }
      );
    }
    if (query.repositoryId && featObj.repositoryId && featObj.repositoryId !== query.repositoryId) {
      throw new FeatureKnowledgeAccessError(
        `Feature '${plan.featureId}' does not belong to repository '${query.repositoryId}'`,
        { featureId: plan.featureId, repositoryId: query.repositoryId }
      );
    }

    const identitySection: FeatureIdentitySection = {
      status: 'AVAILABLE',
      itemCount: 1,
      confidence: 1.0,
      freshness: 'CURRENT',
      knowledgeVersion: '1.0.0',
      lastUpdatedAt: featObj.updatedAt ?? featObj.createdAt ?? Date.now(),
      sourceSubsystem: 'FeatureRegistry',
      data: {
        id: typeof feature.id === 'string' ? feature.id : (feature.id as any).value ?? String(feature.id),
        name: feature.name,
        description: feature.description,
        type: featObj.type ? String(featObj.type) : 'USER_FACING',
        status: featObj.status ? String(featObj.status) : 'ACTIVE',
        origin: featObj.origin,
        scope: featObj.scope,
        metadata: featObj.metadata,
        version: featObj.version,
        createdAt: featObj.createdAt,
        updatedAt: featObj.updatedAt,
      },
    };

    // 2. Resolve remaining sections in parallel
    const [
      mappings,
      dependencies,
      behavior,
      health,
      impact,
      history,
      architecture,
    ] = await Promise.all([
      this.resolveMappings(plan),
      this.resolveDependencies(plan),
      this.resolveBehavior(plan),
      this.resolveHealth(plan),
      this.resolveImpact(plan),
      this.resolveHistory(plan),
      this.resolveArchitecture(plan, featObj),
    ]);

    return {
      identity: identitySection,
      mappings,
      dependencies,
      behavior,
      health,
      impact,
      history,
      architecture,
    };
  }

  private async resolveMappings(plan: FeatureKnowledgeExecutionPlan): Promise<FeatureMappingSection> {
    if (!plan.subsystemsToCall.mapping) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }
    if (!this.deps.mappingRepository) {
      return {
        status: 'NOT_COMPUTED',
        reason: 'FeatureMappingRepository not configured',
        itemCount: 0,
      };
    }

    try {
      const rawMappings = await this.deps.mappingRepository.getMappings(plan.featureId);
      const primaryResources: string[] = [];

      let mappedItems: MappedResourceItem[] = rawMappings.map((m: any) => {
        const role = typeof m.role === 'string' ? m.role : m.role?.value ?? String(m.role ?? 'SUPPORTING');
        if (role === 'PRIMARY' || role === 'ENTRY_POINT' || role === 'CORE') {
          primaryResources.push(m.resourceId);
        }
        return {
          mappingId: m.mappingId ?? m.id ?? `${m.resourceId}_map`,
          resourceId: m.resourceId,
          role,
          confidence: typeof m.confidence === 'number' ? m.confidence : 1.0,
          weight: m.weight,
          active: m.active ?? true,
          metadata: m.metadata,
        };
      });

      if (plan.options.maxItemsPerSection && mappedItems.length > plan.options.maxItemsPerSection) {
        mappedItems = mappedItems.slice(0, plan.options.maxItemsPerSection);
      }

      const avgConfidence =
        mappedItems.length > 0
          ? mappedItems.reduce((acc, curr) => acc + curr.confidence, 0) / mappedItems.length
          : 1.0;

      return {
        status: mappedItems.length > 0 ? 'AVAILABLE' : 'EMPTY',
        itemCount: mappedItems.length,
        confidence: avgConfidence,
        knowledgeVersion: '1.0.0',
        lastUpdatedAt: Date.now(),
        sourceSubsystem: 'FeatureMappingEngine',
        data: {
          mappings: mappedItems,
          primaryResources,
          totalMapped: rawMappings.length,
        },
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        reason: err.message ?? 'Failed to retrieve mappings',
        itemCount: 0,
        error: {
          code: 'MAPPING_RETRIEVAL_FAILED',
          message: err.message ?? 'Unknown error',
          subsystem: 'FeatureMappingEngine',
          details: { section: 'MAPPINGS', timestamp: Date.now() },
        },
      };
    }
  }

  private async resolveDependencies(plan: FeatureKnowledgeExecutionPlan): Promise<FeatureDependencySection> {
    if (!plan.subsystemsToCall.dependencies) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }
    if (!this.deps.relationshipRepository) {
      return {
        status: 'NOT_COMPUTED',
        reason: 'FeatureRelationshipRepository not configured',
        itemCount: 0,
      };
    }

    try {
      const [outgoing, incoming] = await Promise.all([
        this.deps.relationshipRepository.getOutgoing(plan.featureId),
        this.deps.relationshipRepository.getIncoming(plan.featureId),
      ]);

      const depItems: DependencyItem[] = outgoing.map((r: any) => ({
        featureId: r.targetFeatureId ?? r.targetId ?? '',
        relationshipType: typeof r.type === 'string' ? r.type : String(r.type ?? 'DEPENDS_ON'),
        confidence: typeof r.confidence === 'number' ? r.confidence : 1.0,
        criticality: r.criticality,
        direct: true,
      }));

      const dependentItems: DependencyItem[] = incoming.map((r: any) => ({
        featureId: r.sourceFeatureId ?? r.sourceId ?? '',
        relationshipType: typeof r.type === 'string' ? r.type : String(r.type ?? 'DEPENDS_ON'),
        confidence: typeof r.confidence === 'number' ? r.confidence : 1.0,
        criticality: r.criticality,
        direct: true,
      }));

      const totalCount = depItems.length + dependentItems.length;

      return {
        status: totalCount > 0 ? 'AVAILABLE' : 'EMPTY',
        itemCount: totalCount,
        confidence: 1.0,
        knowledgeVersion: '1.0.0',
        lastUpdatedAt: Date.now(),
        sourceSubsystem: 'FeatureDependencyEngine',
        data: {
          dependencies: depItems,
          dependents: dependentItems,
          relationshipCount: totalCount,
        },
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        reason: err.message ?? 'Failed to retrieve dependencies',
        itemCount: 0,
        error: {
          code: 'DEPENDENCY_RETRIEVAL_FAILED',
          message: err.message ?? 'Unknown error',
          subsystem: 'FeatureDependencyEngine',
          details: { section: 'DEPENDENCIES', timestamp: Date.now() },
        },
      };
    }
  }

  private async resolveBehavior(plan: FeatureKnowledgeExecutionPlan): Promise<FeatureBehaviorSection> {
    if (!plan.subsystemsToCall.behavior) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }
    if (!this.deps.behaviorRepository) {
      return {
        status: 'NOT_COMPUTED',
        reason: 'FeatureBehaviorRepository not configured',
        itemCount: 0,
      };
    }

    try {
      const behavior = await this.deps.behaviorRepository.getBehavior(plan.featureId as any);
      if (!behavior) {
        return {
          status: 'EMPTY',
          reason: 'No behavior recorded for this feature',
          itemCount: 0,
          data: {
            entryPoints: [],
            primaryFlows: [],
            failureFlows: [],
            allFlows: [],
          },
        };
      }

      const rawFlows: any[] = (behavior as any).flows ?? [];
      const allFlows: BehaviorFlowItem[] = rawFlows.map((f: any) => ({
        flowId: f.flowId ?? f.id ?? '',
        name: f.name ?? 'Unnamed flow',
        type: typeof f.type === 'string' ? f.type : 'STANDARD',
        isPrimary: Boolean(f.isPrimary ?? false),
        isFailure: Boolean(f.isFailure ?? false),
        stepsCount: f.steps?.length ?? f.stepsCount ?? 0,
        entryPoint: f.entryPoint ?? f.entryPointResourceId,
      }));

      const primaryFlows = allFlows.filter((f) => f.isPrimary);
      const failureFlows = allFlows.filter((f) => f.isFailure);
      const entryPoints: string[] = (behavior as any).entryPoints ?? [];

      return {
        status: allFlows.length > 0 ? 'AVAILABLE' : 'EMPTY',
        itemCount: allFlows.length,
        confidence: 0.9,
        knowledgeVersion: '1.0.0',
        lastUpdatedAt: (behavior as any).updatedAt ?? Date.now(),
        sourceSubsystem: 'FeatureBehaviorEngine',
        data: {
          entryPoints,
          primaryFlows,
          failureFlows,
          allFlows,
        },
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        reason: err.message ?? 'Failed to retrieve behavior',
        itemCount: 0,
        error: {
          code: 'BEHAVIOR_RETRIEVAL_FAILED',
          message: err.message ?? 'Unknown error',
          subsystem: 'FeatureBehaviorEngine',
          details: { section: 'BEHAVIOR', timestamp: Date.now() },
        },
      };
    }
  }

  private async resolveHealth(plan: FeatureKnowledgeExecutionPlan): Promise<FeatureHealthSection> {
    if (!plan.subsystemsToCall.health) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }
    if (!this.deps.healthRepository) {
      return {
        status: 'NOT_COMPUTED',
        reason: 'FeatureHealthRepository not configured',
        itemCount: 0,
      };
    }

    try {
      const health = await this.deps.healthRepository.getByFeatureId(plan.featureId);
      if (!health) {
        return {
          status: 'NOT_COMPUTED',
          reason: 'Health analysis has not been run',
          itemCount: 0,
        };
      }

      const rawRisks: any[] = (health as any).risks ?? [];
      const risks: RiskItem[] = rawRisks.map((r: any) => ({
        riskId: r.id ?? r.riskId ?? '',
        type: typeof r.type === 'string' ? r.type : String(r.type ?? 'GENERIC'),
        severity: typeof r.severity === 'string' ? r.severity : String(r.severity ?? 'MEDIUM'),
        score: typeof r.score === 'number' ? r.score : 50,
        description: r.description ?? '',
        mitigation: r.mitigation,
      }));

      const isStale = Boolean((health as any).isStale);

      return {
        status: isStale ? 'STALE' : 'AVAILABLE',
        itemCount: risks.length + 1,
        confidence: 0.95,
        knowledgeVersion: '1.0.0',
        lastUpdatedAt: (health as any).assessedAt ?? (health as any).updatedAt ?? Date.now(),
        sourceSubsystem: 'FeatureHealthEngine',
        data: {
          healthScore: (health as any).healthScore ?? (health as any).score ?? 80,
          healthStatus: String((health as any).status ?? 'HEALTHY'),
          verificationQuality: (health as any).verificationQuality,
          criticalityScore: (health as any).criticalityScore ?? 50,
          criticalityLevel: String((health as any).criticalityLevel ?? 'MEDIUM'),
          risks,
          dimensions: (health as any).dimensions,
        },
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        reason: err.message ?? 'Failed to retrieve health',
        itemCount: 0,
        error: {
          code: 'HEALTH_RETRIEVAL_FAILED',
          message: err.message ?? 'Unknown error',
          subsystem: 'FeatureHealthEngine',
          details: { section: 'HEALTH', timestamp: Date.now() },
        },
      };
    }
  }

  private async resolveImpact(plan: FeatureKnowledgeExecutionPlan): Promise<FeatureImpactSection> {
    if (!plan.subsystemsToCall.impact) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }
    if (!this.deps.impactRepository) {
      return {
        status: 'NOT_COMPUTED',
        reason: 'ImpactRepository not configured',
        itemCount: 0,
      };
    }

    try {
      const impacts = await this.deps.impactRepository.getFeatureImpacts(plan.featureId);
      if (!impacts || impacts.length === 0) {
        return {
          status: 'EMPTY',
          reason: 'No change impact registered for this feature',
          itemCount: 0,
          data: {
            impactRadius: 0,
            impactScore: 0,
            impactedFeatures: [],
            impactedResources: [],
            propagationPathsCount: 0,
          },
        };
      }

      const impactedFeatures: ImpactedTargetItem[] = [];
      const impactedResources: ImpactedTargetItem[] = [];

      for (const imp of impacts as any[]) {
        const item: ImpactedTargetItem = {
          targetId: imp.targetId ?? imp.featureId ?? '',
          targetType: imp.targetType === 'RESOURCE' ? 'RESOURCE' : 'FEATURE',
          severity: String(imp.severity ?? 'MEDIUM'),
          impactType: String(imp.impactType ?? 'DIRECT'),
          score: typeof imp.score === 'number' ? imp.score : 50,
          distance: typeof imp.distance === 'number' ? imp.distance : 1,
        };
        if (item.targetType === 'RESOURCE') {
          impactedResources.push(item);
        } else {
          impactedFeatures.push(item);
        }
      }

      return {
        status: 'AVAILABLE',
        itemCount: impacts.length,
        confidence: 0.85,
        knowledgeVersion: '1.0.0',
        lastUpdatedAt: Date.now(),
        sourceSubsystem: 'FeatureImpactEngine',
        data: {
          impactRadius: Math.max(...impacts.map((i: any) => i.distance ?? 1), 1),
          impactScore: Math.max(...impacts.map((i: any) => i.score ?? 50), 50),
          impactedFeatures,
          impactedResources,
          propagationPathsCount: impacts.length,
        },
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        reason: err.message ?? 'Failed to retrieve impact',
        itemCount: 0,
        error: {
          code: 'IMPACT_RETRIEVAL_FAILED',
          message: err.message ?? 'Unknown error',
          subsystem: 'FeatureImpactEngine',
          details: { section: 'IMPACT', timestamp: Date.now() },
        },
      };
    }
  }

  private async resolveHistory(plan: FeatureKnowledgeExecutionPlan): Promise<FeatureHistorySection> {
    if (!plan.subsystemsToCall.history) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }
    if (!this.deps.historyRepository) {
      return {
        status: 'NOT_COMPUTED',
        reason: 'FeatureHistoryRepository not configured',
        itemCount: 0,
      };
    }

    try {
      const history = await this.deps.historyRepository.getHistory(plan.featureId);
      if (!history) {
        return {
          status: 'EMPTY',
          reason: 'No history recorded for this feature',
          itemCount: 0,
          data: {
            firstSeenAt: Date.now(),
            lastUpdatedAt: Date.now(),
            versionCount: 1,
            maturityLevel: 'EMERGING',
            milestones: [],
            trends: [],
            recentEventsCount: 0,
            regressionsCount: 0,
          },
        };
      }

      const rawMilestones: any[] = (history as any).milestones ?? [];
      const milestones: MilestoneItem[] = rawMilestones.map((m: any) => ({
        milestoneId: m.milestoneId ?? m.id ?? '',
        milestoneType: String(m.milestoneType ?? m.type ?? 'MILESTONE'),
        title: m.title ?? '',
        description: m.description ?? '',
        timestamp: m.timestamp ?? Date.now(),
        importance: String(m.importance ?? 'NORMAL'),
      }));

      const rawTrends: any[] = (history as any).trends ?? [];
      const trends: TrendItem[] = rawTrends.map((t: any) => ({
        trendType: String(t.trendType ?? t.type ?? 'GENERAL'),
        direction: String(t.direction ?? 'STABLE'),
        description: t.description ?? '',
      }));

      return {
        status: 'AVAILABLE',
        itemCount: milestones.length + trends.length,
        confidence: 0.95,
        knowledgeVersion: '1.0.0',
        lastUpdatedAt: (history as any).updatedAt ?? Date.now(),
        sourceSubsystem: 'FeatureHistoryEngine',
        data: {
          firstSeenAt: (history as any).firstSeenAt ?? Date.now(),
          lastUpdatedAt: (history as any).updatedAt ?? Date.now(),
          versionCount: (history as any).versionCount ?? 1,
          maturityLevel: String((history as any).maturityLevel ?? 'MATURE'),
          milestones,
          trends,
          recentEventsCount: (history as any).events?.length ?? 0,
          regressionsCount: (history as any).regressionsCount ?? 0,
        },
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        reason: err.message ?? 'Failed to retrieve history',
        itemCount: 0,
        error: {
          code: 'HISTORY_RETRIEVAL_FAILED',
          message: err.message ?? 'Unknown error',
          subsystem: 'FeatureHistoryEngine',
          details: { section: 'HISTORY', timestamp: Date.now() },
        },
      };
    }
  }

  private async resolveArchitecture(
    plan: FeatureKnowledgeExecutionPlan,
    featObj: any
  ): Promise<FeatureArchitectureSection> {
    if (!plan.subsystemsToCall.architecture) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }

    const metadata = featObj.metadata ?? {};
    return {
      status: 'AVAILABLE',
      itemCount: 1,
      confidence: 0.9,
      knowledgeVersion: '1.0.0',
      lastUpdatedAt: featObj.updatedAt ?? Date.now(),
      sourceSubsystem: 'FeatureArchitectureService',
      data: {
        layer: metadata.layer,
        domain: metadata.domain,
        patterns: metadata.patterns ?? [],
        components: metadata.components ?? [],
      },
    };
  }
}
