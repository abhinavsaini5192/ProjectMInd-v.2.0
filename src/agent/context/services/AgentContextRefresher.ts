import type { IAgentContextRefresher, RefreshContextOptions, RefreshContextResult } from '../interfaces/IAgentContextRefresher.js';
import type { AgentContextSession } from '../models/AgentContextSession.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../../context/models/ContextRequest.js';
import type { ContextSection } from '../../../context/models/ContextSection.js';

export class AgentContextRefresher implements IAgentContextRefresher {
  constructor(private readonly contextOrchestrator: IContextOrchestrator) {}

  public async refreshContext(
    session: AgentContextSession,
    state: AgentContextState,
    currentPackage: ContextPackage,
    options: RefreshContextOptions,
    pinnedFeatureIds: readonly string[] = [],
    pinnedResourceIds: readonly string[] = []
  ): Promise<RefreshContextResult> {
    const startTime = Date.now();
    const reason = options.reason ?? 'RESOURCE_CHANGED';
    const previousVersion = session.currentContextVersion;
    const refreshedVersion = previousVersion + 1;

    const modifiedFiles = options.modifiedFiles ? Array.from(options.modifiedFiles) : [];
    const affectedFeatures = options.affectedFeatures ? Array.from(options.affectedFeatures) : [];
    const staleSections = options.staleSections ? Array.from(options.staleSections) : [];

    // If full refresh was explicitly requested or staleSections contains 'ALL'
    if (options.forceFullRefresh || staleSections.includes('ALL')) {
      const fullRequest: ContextRequest = {
        workspaceId: session.workspaceId,
        repositoryId: session.repositoryId,
        taskText: session.taskText,
        featureIds: Array.from(new Set([...state.selectedFeatures, ...pinnedFeatureIds])),
        resourceIds: Array.from(new Set([...state.selectedResources, ...pinnedResourceIds])),
        changedResources: modifiedFiles.length > 0 ? modifiedFiles : undefined,
        tokenBudget: options.tokenBudget ?? 8000,
        freshnessPolicy: 'CURRENT',
      };

      const response = await this.contextOrchestrator.orchestrateContext(fullRequest);
      const pkg = response.package;

      const newPackage: ContextPackage = {
        ...pkg,
        packageId: `pkg_${session.contextSessionId}_v${refreshedVersion}`,
        generatedAt: Date.now(),
        freshness: {
          ...pkg.freshness,
          status: 'CURRENT',
          isStale: false,
          lastVerifiedAt: Date.now(),
          invalidationReasons: [],
          staleReasons: [],
        },
        version: {
          ...pkg.version,
          packageVersion: pkg.version?.packageVersion ?? '1.0.0',
          knowledgeVersion: session.currentKnowledgeVersion,
          modelVersion: '1.0.0',
          isConsistent: true,
          mismatchedSubsystems: [],
          generationTimestamp: Date.now(),
        },
      };

      return {
        package: newPackage,
        refreshedVersion,
        previousVersion,
        reason,
        reusedSections: [],
        rebuiltSections: ['ALL'],
        affectedFeatures: affectedFeatures.length > 0 ? affectedFeatures : state.selectedFeatures,
        durationMs: Date.now() - startTime,
      };
    }

    // Smart Partial Refresh:
    // 1. Identify which sections are stale vs reused
    const allPossibleSections: ContextSection[] = [
      'ARCHITECTURE',
      'RESOURCES',
      'DEPENDENCIES',
      'BEHAVIOR',
      'TESTS',
      'HEALTH',
      'IMPACT',
      'HISTORY',
    ];

    const requestedStaleSections: ContextSection[] = [];
    const reusedSections: string[] = [];
    const rebuiltSections: string[] = [];

    for (const sec of allPossibleSections) {
      if (staleSections.includes(sec)) {
        requestedStaleSections.push(sec);
        rebuiltSections.push(sec);
      } else {
        reusedSections.push(sec);
      }
    }

    // If no specific stale sections were provided, refresh RESOURCES, BEHAVIOR, TESTS
    if (requestedStaleSections.length === 0) {
      requestedStaleSections.push('RESOURCES', 'BEHAVIOR', 'TESTS');
      rebuiltSections.push('RESOURCES', 'BEHAVIOR', 'TESTS');
    }

    // 2. Query Context Orchestrator specifically for the affected subset
    const targetedFeatureIds =
      affectedFeatures.length > 0
        ? Array.from(new Set([...affectedFeatures, ...pinnedFeatureIds]))
        : Array.from(new Set([...state.selectedFeatures, ...pinnedFeatureIds]));

    const targetedRequest: ContextRequest = {
      workspaceId: session.workspaceId,
      repositoryId: session.repositoryId,
      taskText: session.taskText,
      featureIds: targetedFeatureIds,
      resourceIds: Array.from(new Set([...modifiedFiles, ...pinnedResourceIds])),
      changedResources: modifiedFiles.length > 0 ? modifiedFiles : undefined,
      requestedSections: requestedStaleSections,
      tokenBudget: options.tokenBudget ?? 8000,
      freshnessPolicy: 'CURRENT',
    };

    const partialResponse = await this.contextOrchestrator.orchestrateContext(targetedRequest);
    const partialPackage = partialResponse.package;

    // 3. Merge: Reuse unaffected context + insert rebuilt sections
    // Merge Features: keep unaffected features from currentPackage, overwrite/add affected
    const mergedFeatures = [...currentPackage.features];
    for (const newFeat of partialPackage.features) {
      const idx = mergedFeatures.findIndex((f) => f.featureId === newFeat.featureId);
      if (idx >= 0) {
        mergedFeatures[idx] = newFeat;
      } else {
        mergedFeatures.push(newFeat);
      }
    }

    // Merge Resources: keep unaffected resources, replace or add modified ones
    const mergedResources = [...currentPackage.resources];
    for (const newRes of partialPackage.resources) {
      const idx = mergedResources.findIndex((r) => r.resourceId === newRes.resourceId || r.path === newRes.path);
      if (idx >= 0) {
        mergedResources[idx] = newRes;
      } else {
        mergedResources.push(newRes);
      }
    }

    // Sections: selectively adopt newly retrieved or reuse existing
    const mergedBehavior = rebuiltSections.includes('BEHAVIOR')
      ? partialPackage.behavior
      : currentPackage.behavior;

    const mergedDependencies = rebuiltSections.includes('DEPENDENCIES')
      ? partialPackage.dependencies
      : currentPackage.dependencies;

    const mergedTests = rebuiltSections.includes('TESTS')
      ? partialPackage.tests
      : currentPackage.tests;

    const mergedHealth = rebuiltSections.includes('HEALTH')
      ? partialPackage.health ?? currentPackage.health
      : currentPackage.health;

    const mergedImpact = rebuiltSections.includes('IMPACT')
      ? partialPackage.impact ?? currentPackage.impact
      : currentPackage.impact;

    const mergedArchitecture = rebuiltSections.includes('ARCHITECTURE')
      ? partialPackage.architecture ?? currentPackage.architecture
      : currentPackage.architecture;

    // Recalculate estimated tokens
    let totalTokens = 0;
    for (const res of mergedResources) {
      totalTokens += res.tokenCount ?? 100;
    }
    totalTokens += mergedFeatures.length * 150;
    totalTokens += (mergedBehavior?.length ?? 0) * 50;
    totalTokens += (mergedDependencies?.length ?? 0) * 30;
    totalTokens += (mergedTests?.length ?? 0) * 40;

    const newPackage: ContextPackage = {
      packageId: `pkg_${session.contextSessionId}_v${refreshedVersion}`,
      generatedAt: Date.now(),
      task: {
        text: session.taskText,
        intent: currentPackage.task?.intent,
      },
      features: mergedFeatures,
      resources: mergedResources,
      architecture: mergedArchitecture,
      behavior: mergedBehavior,
      dependencies: mergedDependencies,
      tests: mergedTests,
      health: mergedHealth,
      impact: mergedImpact,
      history: currentPackage.history,
      warnings: partialPackage.warnings ?? currentPackage.warnings ?? [],
      selectionReasons: {
        ...currentPackage.selectionReasons,
        ...partialPackage.selectionReasons,
      },
      completeness: partialPackage.completeness ?? currentPackage.completeness,
      freshness: {
        ...currentPackage.freshness,
        status: 'CURRENT',
        isStale: false,
        lastVerifiedAt: Date.now(),
        invalidationReasons: [],
        staleReasons: [],
      },
      estimatedTokens: totalTokens,
      version: {
        ...currentPackage.version,
        packageVersion: currentPackage.version?.packageVersion ?? '1.0.0',
        knowledgeVersion: session.currentKnowledgeVersion,
        modelVersion: '1.0.0',
        isConsistent: true,
        mismatchedSubsystems: [],
        generationTimestamp: Date.now(),
      },
    };

    return {
      package: newPackage,
      refreshedVersion,
      previousVersion,
      reason,
      reusedSections,
      rebuiltSections,
      affectedFeatures: targetedFeatureIds,
      durationMs: Date.now() - startTime,
    };
  }
}
