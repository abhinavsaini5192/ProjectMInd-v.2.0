import type { FeatureId } from '../../models/FeatureId';
import type { IFeatureBehaviorEngine } from '../interfaces/IFeatureBehaviorEngine';
import type { IFeatureBehaviorRepository } from '../interfaces/IFeatureBehaviorRepository';
import type { BehaviorContext, IFeatureBehaviorSource } from '../interfaces/IFeatureBehaviorSource';
import type { IFeatureBehaviorValidator } from '../interfaces/IFeatureBehaviorValidator';
import type { IFeatureFlowBuilder } from '../interfaces/IFeatureFlowBuilder';
import type { FeatureBehavior } from '../models/FeatureBehavior';
import type { FeatureBehaviorCandidate } from '../models/FeatureBehaviorCandidate';
import type { FeatureBehaviorConflict } from '../models/FeatureBehaviorConflict';
import type { FeatureBehaviorResult } from '../models/FeatureBehaviorResult';
import type { FeatureFlow } from '../models/FeatureFlow';
import { AuthorizationFlowSource } from '../sources/AuthorizationFlowSource';
import { BehaviorSourceHelper } from '../sources/BehaviorSourceHelper';
import { CallChainSource } from '../sources/CallChainSource';
import { ControlFlowSource } from '../sources/ControlFlowSource';
import { DatabaseFlowSource } from '../sources/DatabaseFlowSource';
import { DataFlowSource } from '../sources/DataFlowSource';
import { EndpointFlowSource } from '../sources/EndpointFlowSource';
import { EntryPointSource } from '../sources/EntryPointSource';
import { ErrorFlowSource } from '../sources/ErrorFlowSource';
import { EventFlowSource } from '../sources/EventFlowSource';
import { HistoryBehaviorSource } from '../sources/HistoryBehaviorSource';
import { IntegrationFlowSource } from '../sources/IntegrationFlowSource';
import { TestBehaviorSource } from '../sources/TestBehaviorSource';
import { ValidationFlowSource } from '../sources/ValidationFlowSource';
import { FeatureBehaviorAnalyzer } from './FeatureBehaviorAnalyzer';
import { FeatureBehaviorExplainer } from './FeatureBehaviorExplainer';
import { FeatureBehaviorNormalizer } from './FeatureBehaviorNormalizer';
import { FeatureBehaviorValidator } from './FeatureBehaviorValidator';
import { FeatureFlowBuilder } from './FeatureFlowBuilder';
import { FeatureFlowResolver } from './FeatureFlowResolver';

export class FeatureBehaviorEngine implements IFeatureBehaviorEngine {
  private sources: IFeatureBehaviorSource[];
  private flowBuilder: IFeatureFlowBuilder;
  private normalizer: FeatureBehaviorNormalizer;
  private validator: IFeatureBehaviorValidator;
  private resolver: FeatureFlowResolver;
  private analyzer: FeatureBehaviorAnalyzer;
  private explainer: FeatureBehaviorExplainer;
  private repository: IFeatureBehaviorRepository;

  constructor(
    repository: IFeatureBehaviorRepository,
    options?: {
      sources?: IFeatureBehaviorSource[];
      flowBuilder?: IFeatureFlowBuilder;
      validator?: IFeatureBehaviorValidator;
      normalizer?: FeatureBehaviorNormalizer;
      resolver?: FeatureFlowResolver;
      analyzer?: FeatureBehaviorAnalyzer;
      explainer?: FeatureBehaviorExplainer;
    }
  ) {
    this.repository = repository;
    this.flowBuilder = options?.flowBuilder || new FeatureFlowBuilder();
    this.normalizer = options?.normalizer || new FeatureBehaviorNormalizer();
    this.validator = options?.validator || new FeatureBehaviorValidator();
    this.resolver = options?.resolver || new FeatureFlowResolver();
    this.analyzer = options?.analyzer || new FeatureBehaviorAnalyzer();
    this.explainer = options?.explainer || new FeatureBehaviorExplainer();

    this.sources = options?.sources || [
      new EntryPointSource(),
      new CallChainSource(),
      new ControlFlowSource(),
      new DataFlowSource(),
      new EndpointFlowSource(),
      new DatabaseFlowSource(),
      new EventFlowSource(),
      new IntegrationFlowSource(),
      new ValidationFlowSource(),
      new AuthorizationFlowSource(),
      new ErrorFlowSource(),
      new TestBehaviorSource(),
      new HistoryBehaviorSource(),
    ];

    // Sort sources by priority descending
    this.sources.sort((a, b) => b.priority - a.priority);
  }

  public async analyzeFeatureBehavior(
    featureId: FeatureId,
    context: BehaviorContext
  ): Promise<FeatureBehaviorResult> {
    const startedAt = Date.now();
    const runId = BehaviorSourceHelper.generateId('run');

    // 1. Collect candidates from all registered sources
    const allCandidates: FeatureBehaviorCandidate[] = [];
    for (const source of this.sources) {
      try {
        const candidates = await source.extractBehavior(context);
        allCandidates.push(...candidates);
      } catch (err) {
        // Individual source errors do not abort the pipeline
      }
    }

    // 2. Build cohesive flows from fragments
    const builtFlows = await this.flowBuilder.buildFlows(allCandidates, context);

    // 3. Normalize & deduplicate flows
    const normalizedFlows = this.normalizer.normalizeFlows(builtFlows);

    // 4. Annotate cross-feature boundary hops
    this.analyzer.analyzeBoundaries(normalizedFlows, context);

    // 5. Resolve primary, alternative, and failure flows + conflicts
    const resolved = this.resolver.resolveFlows(normalizedFlows, context);

    // 6. Compute calibrated overall confidence
    const confidence = this.analyzer.computeConfidence(
      normalizedFlows,
      resolved.conflicts,
      context
    );

    // 7. Extract entry points
    const entryPoints = normalizedFlows.flatMap(f =>
      f.nodes.filter(n => n.stepType === 'ENTRY_POINT')
    );
    const uniqueEntryPoints = entryPoints.filter(
      (ep, idx, self) => self.findIndex(s => s.resourceId === ep.resourceId) === idx
    );

    // Check for previous behavior to handle updates/stale versions
    const existing = await this.repository.getBehavior(featureId);
    const behaviorVersion = existing ? existing.behaviorVersion + 1 : 1;

    const behavior: FeatureBehavior = {
      behaviorId: existing ? existing.behaviorId : BehaviorSourceHelper.generateId('behavior'),
      featureId,
      flows: normalizedFlows,
      entryPoints: uniqueEntryPoints,
      primaryFlows: resolved.primaryFlows,
      alternativeFlows: resolved.alternativeFlows,
      failureFlows: resolved.failureFlows,
      confidence,
      evidence: normalizedFlows.flatMap(f => f.evidence),
      active: true,
      behaviorVersion,
      knowledgeVersion: '6.5.0',
      createdAt: existing ? existing.createdAt : startedAt,
      updatedAt: Date.now(),
    };

    // 8. Validate behavior
    await this.validator.validateBehavior(behavior, context);

    // 9. Save behavior and conflicts to repository
    await this.repository.saveBehavior(behavior);
    for (const conflict of resolved.conflicts) {
      await this.repository.saveConflict(conflict);
    }

    const completedAt = Date.now();
    const durationMs = completedAt - startedAt;

    const newBehaviors = existing ? [] : [behavior];
    const updatedBehaviors = existing ? [behavior] : [];
    const staleBehaviors: FeatureBehavior[] = [];

    const totalNodes = normalizedFlows.reduce((sum, f) => sum + f.nodes.length, 0);
    const totalEdges = normalizedFlows.reduce((sum, f) => sum + f.edges.length, 0);

    return {
      runId,
      startedAt,
      completedAt,
      durationMs,
      behaviors: [behavior],
      newBehaviors,
      updatedBehaviors,
      staleBehaviors,
      conflicts: resolved.conflicts,
      statistics: {
        flowsEvaluated: normalizedFlows.length,
        nodesCreated: totalNodes,
        edgesCreated: totalEdges,
        conflictsDetected: resolved.conflicts.length,
        featuresAnalyzed: 1,
        pathsComputed: normalizedFlows.length,
      },
    };
  }

  public async analyzeBatch(
    featureIds: FeatureId[],
    context: BehaviorContext
  ): Promise<FeatureBehaviorResult> {
    const startedAt = Date.now();
    const runId = BehaviorSourceHelper.generateId('batch_run');

    const allBehaviors: FeatureBehavior[] = [];
    const newBehaviors: FeatureBehavior[] = [];
    const updatedBehaviors: FeatureBehavior[] = [];
    const allConflicts: FeatureBehaviorConflict[] = [];

    let totalFlows = 0;
    let totalNodes = 0;
    let totalEdges = 0;

    for (const fid of featureIds) {
      const feat = context.allFeatures?.find(f => f.id === fid) || {
        ...context.feature,
        id: fid,
        name: fid,
      };
      const featMappings = Array.isArray(context.allMappings)
        ? context.allMappings.filter(m => m.featureId === fid)
        : (context.allMappings?.get(fid) || context.mappings);

      const subContext: BehaviorContext = {
        ...context,
        feature: feat,
        mappings: featMappings,
      };

      const res = await this.analyzeFeatureBehavior(fid, subContext);
      allBehaviors.push(...res.behaviors);
      newBehaviors.push(...res.newBehaviors);
      updatedBehaviors.push(...res.updatedBehaviors);
      allConflicts.push(...res.conflicts);

      totalFlows += res.statistics.flowsEvaluated;
      totalNodes += res.statistics.nodesCreated;
      totalEdges += res.statistics.edgesCreated;
    }

    const completedAt = Date.now();

    return {
      runId,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      behaviors: allBehaviors,
      newBehaviors,
      updatedBehaviors,
      staleBehaviors: [],
      conflicts: allConflicts,
      statistics: {
        flowsEvaluated: totalFlows,
        nodesCreated: totalNodes,
        edgesCreated: totalEdges,
        conflictsDetected: allConflicts.length,
        featuresAnalyzed: featureIds.length,
        pathsComputed: totalFlows,
      },
    };
  }

  public async analyzeIncremental(
    changedResourceIds: string[],
    context: BehaviorContext
  ): Promise<FeatureBehaviorResult> {
    const startedAt = Date.now();
    const runId = BehaviorSourceHelper.generateId('incremental_run');

    if (changedResourceIds.length === 0) {
      return {
        runId,
        startedAt,
        completedAt: Date.now(),
        durationMs: 0,
        behaviors: [],
        newBehaviors: [],
        updatedBehaviors: [],
        staleBehaviors: [],
        conflicts: [],
        statistics: {
          flowsEvaluated: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          conflictsDetected: 0,
          featuresAnalyzed: 0,
          pathsComputed: 0,
        },
      };
    }

    // 1. Identify directly affected features
    const affectedFeatureIds = new Set<FeatureId>();

    // Check context.mappings
    if (context.mappings.some(m => changedResourceIds.includes(m.resourceId))) {
      affectedFeatureIds.add(context.feature.id);
    }

    // Check context.allMappings
    if (context.allMappings) {
      if (context.allMappings instanceof Map) {
        for (const [featId, maps] of context.allMappings.entries()) {
          if (maps.some(m => changedResourceIds.includes(m.resourceId))) {
            affectedFeatureIds.add(featId);
          }
        }
      } else if (Array.isArray(context.allMappings)) {
        for (const m of context.allMappings) {
          if (changedResourceIds.includes(m.resourceId)) {
            affectedFeatureIds.add(m.featureId);
          }
        }
      }
    }

    // 2. Identify indirectly affected features (downstream cross-feature flows)
    const allStoredBehaviors = await this.repository.getAllBehaviors();
    for (const beh of allStoredBehaviors) {
      const touchesChangedBoundary = beh.flows.some(f =>
        f.nodes.some(
          n =>
            n.metadata?.featureBoundary &&
            ((n.metadata.targetFeatureId && affectedFeatureIds.has(n.metadata.targetFeatureId)) ||
              changedResourceIds.includes(n.resourceId))
        )
      );
      if (touchesChangedBoundary) {
        affectedFeatureIds.add(beh.featureId);
      }
    }

    // If target feature wasn't in allMappings but has changed resources
    if (affectedFeatureIds.size === 0) {
      affectedFeatureIds.add(context.feature.id);
    }

    // 3. Re-analyze only affected features
    return this.analyzeBatch(Array.from(affectedFeatureIds), context);
  }

  public async getBehavior(featureId: FeatureId): Promise<FeatureBehavior | null> {
    return this.repository.getBehavior(featureId);
  }

  public async explainFlow(flowId: string): Promise<string> {
    const flow = await this.repository.getFlow(flowId);
    if (!flow) {
      return `Flow with ID "${flowId}" not found.`;
    }
    return this.explainer.explainFlow(flow);
  }

  public explainBehavior(behavior: FeatureBehavior, featureName: string): string {
    return this.explainer.explainBehavior(behavior, featureName);
  }
}
