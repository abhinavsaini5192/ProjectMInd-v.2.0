import type { IContextOrchestrator } from '../interfaces/IContextOrchestrator.js';
import type { IContextPlanner } from '../interfaces/IContextPlanner.js';
import type { IContextRetriever } from '../interfaces/IContextRetriever.js';
import type { IContextSelector } from '../interfaces/IContextSelector.js';
import type { ITokenBudgetManager } from '../interfaces/ITokenBudgetManager.js';
import type { IContextPacker } from '../interfaces/IContextPacker.js';
import type { IContextExplanationService } from '../interfaces/IContextExplanationService.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextResponse } from '../models/ContextResponse.js';
import type { ContextPlan } from '../models/ContextPlan.js';
import type { ContextPackage } from '../models/ContextPackage.js';
import type { ContextExplanation } from '../models/ContextExplanation.js';
import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';
import type { IContextSemanticModel } from '../task/IContextSemanticModel.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IVerificationQueryService } from '../../verification/interfaces/IVerificationQueryService.js';
import type { IVerificationStore } from '../../verification/interfaces/IVerificationStore.js';

import { ContextPlanner } from '../planning/ContextPlanner.js';
import { ContextPlanValidator } from '../planning/ContextPlanValidator.js';
import { ContextSelector } from '../selection/ContextSelector.js';
import { TokenBudgetManager } from '../budgeting/TokenBudgetManager.js';
import { ContextPackageBuilder } from '../packing/ContextPackageBuilder.js';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import { ContextExplanationService } from './ContextExplanationService.js';
import { ContextRequestResolver } from './ContextRequestResolver.js';
import { ContextCache } from '../cache/ContextCache.js';
import { ContextCacheKeyBuilder } from '../cache/ContextCacheKeyBuilder.js';
import { ContextOrchestrationError } from '../errors/ContextOrchestrationError.js';

// Phase 9.3 Advanced Context Intelligence Engines
import { TaskUnderstandingEngine } from '../task/TaskUnderstandingEngine.js';
import { ContextCandidateResolver } from '../intelligence/ContextCandidateResolver.js';
import { ContextRelevanceEngine } from '../intelligence/ContextRelevanceEngine.js';
import { ContextExpansionEngine } from '../intelligence/ContextExpansionEngine.js';
import { ContextCompressionEngine } from '../intelligence/ContextCompressionEngine.js';
import { ContextQualityEvaluator } from '../intelligence/ContextQualityEvaluator.js';
import { ContextValidator } from '../intelligence/ContextValidator.js';
import { ContextExplanationEngine } from '../intelligence/ContextExplanationEngine.js';

import type { IProjectMemoryStore } from '../../memory/project/interfaces/IProjectMemoryStore.js';
import type { IRetrievalEngine } from '../../retrieval/interfaces/IRetrievalEngine.js';

export class ContextOrchestrator implements IContextOrchestrator {
  private readonly planner: IContextPlanner;
  private readonly retriever: IContextRetriever;
  private readonly selector: IContextSelector;
  private readonly budgetManager: ITokenBudgetManager;
  private readonly packer: IContextPacker;
  private readonly adapterRegistry: AdapterRegistry;
  private readonly explanationService: IContextExplanationService;
  private readonly cache?: ContextCache | undefined;

  // Phase 9.3 Intelligence Subsystems
  private readonly taskUnderstandingEngine: TaskUnderstandingEngine;
  private readonly candidateResolver: ContextCandidateResolver;
  private readonly relevanceEngine: ContextRelevanceEngine;
  private readonly expansionEngine: ContextExpansionEngine;
  private readonly compressionEngine: ContextCompressionEngine;
  private readonly qualityEvaluator: ContextQualityEvaluator;
  private readonly contextValidator: ContextValidator;
  private readonly advancedExplanationEngine: ContextExplanationEngine;

  constructor(
    retriever: IContextRetriever,
    planner?: IContextPlanner | undefined,
    selector?: IContextSelector | undefined,
    budgetManager?: ITokenBudgetManager | undefined,
    packer?: IContextPacker | undefined,
    adapterRegistry?: AdapterRegistry | undefined,
    explanationService?: IContextExplanationService | undefined,
    cache?: ContextCache | undefined,
    semanticModel?: IContextSemanticModel | undefined,
    featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined,
    verificationService?: IVerificationQueryService | IVerificationStore | undefined,
    memoryStore?: IProjectMemoryStore | undefined,
    retrievalEngine?: IRetrievalEngine | undefined
  ) {
    this.retriever = retriever;
    this.planner = planner ?? new ContextPlanner();
    this.selector = selector ?? new ContextSelector();
    this.budgetManager = budgetManager ?? new TokenBudgetManager();
    this.packer = packer ?? new ContextPackageBuilder();
    this.adapterRegistry = adapterRegistry ?? new AdapterRegistry();
    this.explanationService = explanationService ?? new ContextExplanationService();
    this.cache = cache ?? new ContextCache();

    // Initialize Phase 9.3 & 9.4 components
    this.taskUnderstandingEngine = new TaskUnderstandingEngine(semanticModel);
    this.candidateResolver = new ContextCandidateResolver(
      featureKnowledgeApi,
      verificationService,
      memoryStore,
      retrievalEngine
    );
    this.relevanceEngine = new ContextRelevanceEngine();
    this.expansionEngine = new ContextExpansionEngine();
    this.compressionEngine = new ContextCompressionEngine();
    this.qualityEvaluator = new ContextQualityEvaluator();
    this.contextValidator = new ContextValidator();
    this.advancedExplanationEngine = new ContextExplanationEngine();
  }

  public validateContextRequest(request: ContextRequest): void {
    ContextPlanValidator.validate(request);
  }

  public async understandTask(request: ContextRequest): Promise<TaskUnderstanding> {
    const resolved = ContextRequestResolver.resolve(request);
    return this.taskUnderstandingEngine.understandTask(resolved);
  }

  public async orchestrateContext(request: ContextRequest): Promise<ContextResponse> {
    const startTime = Date.now();

    try {
      this.validateContextRequest(request);
      const resolvedRequest = ContextRequestResolver.resolve(request);

      // Check cache if freshness policy allows
      const cacheKey = ContextCacheKeyBuilder.buildKey(resolvedRequest);
      if (resolvedRequest.freshnessPolicy !== 'CURRENT' && this.cache) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return {
            ...cached,
            durationMs: Date.now() - startTime,
            cached: true,
          };
        }
      }

      // 1. Task Understanding
      const taskUnderstanding = await this.taskUnderstandingEngine.understandTask(resolvedRequest);
      resolvedRequest.taskUnderstanding = taskUnderstanding;

      // 2. Planning
      const initialFeatureIds = resolvedRequest.featureIds ?? [];
      const plan = await this.planner.planContext(resolvedRequest, initialFeatureIds);

      // 3. Retrieval via Coordinator
      const retrieved = await this.retriever.retrieveContext(plan, resolvedRequest);

      // 4. Resolve Actual Feature IDs from request and retrieval
      const activeFeatureIds = Array.from(
        new Set([...initialFeatureIds, ...retrieved.resolvedDirectFeatures, ...(taskUnderstanding.candidateFeatures ?? [])])
      );

      // 5. Candidate Knowledge Generation
      const candidates = await this.candidateResolver.resolveCandidates(
        taskUnderstanding,
        resolvedRequest,
        activeFeatureIds
      );

      // 6. Multi-dimensional Relevance Evaluation & Prioritization
      const scoredCandidates = this.relevanceEngine.scoreCandidates(
        candidates,
        taskUnderstanding,
        resolvedRequest
      );

      // 7. Controlled Progressive Expansion
      const budgetLimit = resolvedRequest.tokenBudget ?? plan.budget?.totalBudget ?? 4000;
      const expansionResult = this.expansionEngine.expand(
        scoredCandidates,
        taskUnderstanding,
        budgetLimit
      );

      // 8. Context Compression & Source Fragment Selection
      const compressionResult = this.compressionEngine.compress(
        expansionResult.selectedCandidates,
        resolvedRequest.compressionMode ?? (resolvedRequest.compactMode ? 'COMPACT' : 'FULL')
      );

      // 9. Selection & Scoring
      const selected = this.selector.select(retrieved, plan, resolvedRequest);

      // 10. Token Budgeting
      const budgeted = this.budgetManager.applyBudget(selected, plan.budget);

      // 11. Packing & Integrity
      const allWarnings = [...retrieved.warnings, ...budgeted.warnings];
      const pkg = this.packer.buildPackage({
        request: resolvedRequest,
        plan,
        selected: budgeted.data,
        allocation: budgeted.allocation,
        warnings: allWarnings,
        retrieved,
      });

      // 12. Attach Phase 9.2 Scope and Phase 9.3 Intelligence fields
      pkg.workspaceId = resolvedRequest.workspaceId;
      pkg.projectId = resolvedRequest.projectId ?? resolvedRequest.projectContext?.projectId;
      pkg.repositoryId = resolvedRequest.repositoryId;
      pkg.taskUnderstanding = taskUnderstanding;
      pkg.sourceFragments = compressionResult.sourceFragments;
      pkg.exclusions = expansionResult.exclusions;

      // Sync resource priority and append newly resolved candidates from intelligence/semantic retrieval
      for (const cand of expansionResult.selectedCandidates) {
        if (cand.candidateType === 'FILE' && (cand.path || cand.name)) {
          const filePath = cand.path ?? cand.name;
          const existing = pkg.resources.find((r) => r.filePath === filePath);
          if (existing) {
            if (cand.priority === 'CRITICAL' || cand.priority === 'HIGH') {
              existing.priority = cand.priority;
            }
          } else {
            pkg.resources.push({
              resourceId: cand.candidateId,
              filePath,
              role: cand.candidateType,
              featureId: (cand.metadata?.['featureId'] as string) ?? 'SEMANTIC_RETRIEVAL',
              priority: cand.priority === 'OPTIONAL' ? 'LOW' : (cand.priority as any) ?? 'MEDIUM',
              relevance: {
                score: cand.score,
                confidence: cand.dimensions?.confidence ?? 0.8,
                importance: cand.score,
                directness: cand.priority === 'CRITICAL' || cand.priority === 'HIGH',
                reasons: [cand.primaryEvidence],
              },
              estimatedTokens: cand.estimatedTokens,
              metadata: cand.metadata,
            });
          }
        }
      }

      // 13. Explanations (inclusions and exclusions)
      const advancedExplanations = this.advancedExplanationEngine.generateExplanations(
        expansionResult.selectedCandidates,
        expansionResult.exclusions,
        taskUnderstanding
      );

      pkg.selectionReasons = {
        ...pkg.selectionReasons,
        ...advancedExplanations.selectedReasons,
      };

      // 14. Context Quality Evaluation
      pkg.quality = this.qualityEvaluator.evaluate(
        expansionResult.selectedCandidates,
        taskUnderstanding,
        budgetLimit,
        pkg.freshness?.status ?? 'FRESH'
      );

      // 15. Pre-delivery Validation
      this.contextValidator.validate(pkg, resolvedRequest);

      // 16. Model Adaptation
      const adapter = this.adapterRegistry.getAdapter(resolvedRequest.outputFormat);
      const adapterResponse = adapter.formatContext({
        package: pkg,
        format: resolvedRequest.outputFormat,
        includeDelimiters: true,
        includeExplanations:
          resolvedRequest.includeExplanations ?? resolvedRequest.explainSelection,
      });

      pkg.compiledPromptText = adapterResponse.formattedContent;

      const explanations =
        resolvedRequest.explainSelection || resolvedRequest.includeExplanations
          ? this.explanationService.generateExplanation(resolvedRequest, budgeted.data)
          : undefined;

      const response: ContextResponse = {
        success: true,
        package: pkg,
        formattedPrompt: adapterResponse.formattedContent,
        plan,
        explanations,
        warnings: pkg.warnings,
        durationMs: Date.now() - startTime,
        cached: false,
      };

      // 17. Cache response
      if (this.cache) {
        this.cache.set(cacheKey, response, resolvedRequest.repositoryId);
      }

      return response;
    } catch (err: any) {
      if (
        err.name === 'ContextPlanningError' ||
        err.name === 'UnsupportedContextFormatError' ||
        err.name === 'ScopeViolationError' ||
        err.name === 'ContextValidationError'
      ) {
        throw err;
      }
      throw new ContextOrchestrationError(
        `Context orchestration failed: ${err.message ?? String(err)}`,
        'CONTEXT_ORCHESTRATION_FAILED',
        { originalError: err }
      );
    }
  }

  public async getContextPlan(request: ContextRequest): Promise<ContextPlan> {
    this.validateContextRequest(request);
    const resolved = ContextRequestResolver.resolve(request);
    return this.planner.planContext(resolved, resolved.featureIds ?? []);
  }

  public async getContextPackage(request: ContextRequest): Promise<ContextPackage> {
    const resp = await this.orchestrateContext(request);
    return resp.package;
  }

  public async getFeatureContextForTask(request: ContextRequest): Promise<ContextResponse> {
    return this.orchestrateContext(request);
  }

  public async getContextExplanation(request: ContextRequest): Promise<ContextExplanation> {
    const resp = await this.orchestrateContext({
      ...request,
      explainSelection: true,
      includeExplanations: true,
    });

    if (resp.explanations) {
      return resp.explanations;
    }

    return this.explanationService.generateExplanation(request, {
      features: resp.package.features,
      resources: resp.package.resources,
      behaviorFlows: resp.package.behavior,
      tests: resp.package.tests,
      risks: resp.package.health?.activeRisks ?? [],
      milestones: resp.package.history,
      explanations: resp.package.selectionReasons,
    });
  }

  public async estimateContextTokens(request: ContextRequest): Promise<number> {
    const pkg = await this.getContextPackage(request);
    return pkg.estimatedTokens;
  }
}
