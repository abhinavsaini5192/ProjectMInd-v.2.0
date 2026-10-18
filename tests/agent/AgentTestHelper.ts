import type { IEventBus, EventHandler } from '../../src/workspace/interfaces/IEventBus.js';
import type { IContextOrchestrator } from '../../src/context/interfaces/IContextOrchestrator.js';
import type { IFeatureKnowledgeAPI } from '../../src/knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';
import type { ContextResponse } from '../../src/context/models/ContextResponse.js';
import type { ContextPlan } from '../../src/context/models/ContextPlan.js';
import type { ContextPackage } from '../../src/context/models/ContextPackage.js';
import type { ContextExplanation } from '../../src/context/models/ContextExplanation.js';
import type { FeatureKnowledgeResponse } from '../../src/knowledge/features/api/models/FeatureKnowledgeResponse.js';
import type { FeatureKnowledgeSummary } from '../../src/knowledge/features/api/models/FeatureKnowledgeSummary.js';
import type { FeatureMappingSection } from '../../src/knowledge/features/api/sections/FeatureMappingSection.js';
import type { FeatureDependencySection } from '../../src/knowledge/features/api/sections/FeatureDependencySection.js';
import type { FeatureBehaviorSection } from '../../src/knowledge/features/api/sections/FeatureBehaviorSection.js';
import type { FeatureHealthSection } from '../../src/knowledge/features/api/sections/FeatureHealthSection.js';
import type { FeatureImpactSection } from '../../src/knowledge/features/api/sections/FeatureImpactSection.js';
import type { FeatureHistorySection } from '../../src/knowledge/features/api/sections/FeatureHistorySection.js';
import type { FeatureArchitectureSection } from '../../src/knowledge/features/api/sections/FeatureArchitectureSection.js';
import type { FeatureKnowledgeContextPackage } from '../../src/knowledge/features/api/models/FeatureKnowledgeContextPackage.js';
import type { FeatureKnowledgeCompleteness } from '../../src/knowledge/features/api/models/FeatureKnowledgeCompleteness.js';
import type { FeatureKnowledgeFreshness } from '../../src/knowledge/features/api/models/FeatureKnowledgeFreshness.js';
import type { FeatureKnowledgeVersion } from '../../src/knowledge/features/api/models/FeatureKnowledgeVersion.js';
import type { FeatureKnowledgeQuery } from '../../src/knowledge/features/api/models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeOptions } from '../../src/knowledge/features/api/models/FeatureKnowledgeOptions.js';

import { AgentDISetup } from '../../src/agent/di/AgentDISetup.js';
import { AgentCapabilitySet } from '../../src/agent/models/AgentCapabilitySet.js';
import { AGENT_CAPABILITIES } from '../../src/agent/models/AgentCapability.js';
import { CURRENT_AGENT_PROTOCOL_VERSION } from '../../src/agent/models/AgentProtocolVersion.js';
import type { AgentRequest } from '../../src/agent/models/AgentRequest.js';
import type { AgentOperationType } from '../../src/agent/models/AgentOperation.js';

export class MockEventBus implements IEventBus {
  public readonly events: { name: string; payload: unknown }[] = [];
  private readonly handlers = new Map<string, Set<EventHandler>>();

  public publish<T>(eventName: string, payload: T): void {
    this.events.push({ name: eventName, payload });
    const set = this.handlers.get(eventName);
    if (set) {
      for (const h of set) {
        h({
          id: `evt_${Date.now()}`,
          name: eventName,
          timestamp: new Date(),
          payload,
        } as any);
      }
    }
  }

  public subscribe<T>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler as EventHandler);
  }

  public unsubscribe<T>(eventName: string, handler: EventHandler<T>): void {
    this.handlers.get(eventName)?.delete(handler as EventHandler);
  }
}

export class MockContextOrchestrator implements IContextOrchestrator {
  public orchestrateContextCalls: ContextRequest[] = [];
  public getExplanationCalls: ContextRequest[] = [];

  public async orchestrateContext(request: ContextRequest): Promise<ContextResponse> {
    this.orchestrateContextCalls.push(request);
    const plan = await this.getContextPlan(request);
    const pkg = await this.getContextPackage(request);

    return {
      success: true,
      package: pkg,
      plan,
      formattedPrompt: `# Context for ${request.repositoryId}\nTask: ${request.taskText ?? 'general'}`,
      warnings: [],
      durationMs: 10,
      cached: false,
    };
  }

  public async getContextPlan(request: ContextRequest): Promise<ContextPlan> {
    return {
      planId: 'plan_1',
      targetFeatureIds: request.featureIds ?? [],
      dependentFeatureIds: [],
      requiredSections: [],
      requirements: [],
      budget: {
        totalBudget: request.tokenBudget ?? 8000,
        reservedForPrompt: 1000,
        availableForContext: 7000,
      },
      sectionQuotas: {},
      maxDepth: 2,
      scope: {
        targetFeatureIds: request.featureIds ?? [],
        targetResourceIds: [],
        excludedFeatureIds: [],
        excludedResourceIds: [],
        maxDepth: 2,
      },
      format: 'MARKDOWN',
      estimatedTokens: 120,
      compactMode: false,
      createdAt: Date.now(),
    } as unknown as ContextPlan;
  }

  public async getContextPackage(request: ContextRequest): Promise<ContextPackage> {
    return {
      packageId: 'pkg_1',
      generatedAt: Date.now(),
      task: {
        text: request.taskText ?? 'general',
      },
      features: [],
      resources: [],
      behavior: [],
      dependencies: [],
      tests: [],
      history: [],
      warnings: [],
      selectionReasons: {},
      completeness: {
        score: 1.0,
        sectionCompleteness: {},
        missingElements: [],
        isComplete: true,
      },
      freshness: {
        status: 'CURRENT',
        isFresh: true,
        staleReason: undefined,
        calculatedAt: Date.now(),
      },
      estimatedTokens: 150,
      version: {
        major: 1,
        minor: 0,
        patch: 0,
        hash: 'hash123',
      },
      compiledPromptText: `# Context for ${request.repositoryId}\nTask: ${request.taskText ?? 'general'}`,
    } as unknown as ContextPackage;
  }

  public async getFeatureContextForTask(request: ContextRequest): Promise<ContextResponse> {
    return this.orchestrateContext(request);
  }

  public async getContextExplanation(request: ContextRequest): Promise<ContextExplanation> {
    this.getExplanationCalls.push(request);
    return {
      taskAnalysisSummary: 'Explanation of selected context',
      featureSelectionReasons: { feat_1: 'Explicitly requested in task' },
      resourceSelectionReasons: {},
      omissionReasons: {},
      detailedExplanations: [
        {
          targetId: 'feat_1',
          targetType: 'FEATURE',
          reason: 'Explicitly requested in task',
          score: 1.0,
          subsystemSource: 'FEATURE_INTELLIGENCE',
        },
      ],
    };
  }

  public async estimateContextTokens(_request: ContextRequest): Promise<number> {
    return 150;
  }

  public validateContextRequest(_request: ContextRequest): void {}
}

export class MockFeatureKnowledgeAPI implements IFeatureKnowledgeAPI {
  public async getFeatureKnowledge(
    queryOrId: FeatureKnowledgeQuery | string
  ): Promise<FeatureKnowledgeResponse> {
    const id = typeof queryOrId === 'string' ? queryOrId : queryOrId.featureId;
    return this.getFeatureProfile(id);
  }

  public async getFeatureProfile(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeResponse> {
    return {
      success: true,
      profile: {
        featureId,
        identity: {
          featureId,
          name: `Feature ${featureId}`,
          description: `Description for ${featureId}`,
          status: 'ACTIVE',
        } as any,
      } as any,
      metadata: {
        retrievedAt: Date.now(),
        version: {
          versionString: '1.0',
          isStale: false,
          staleReasons: [],
          lastRebuiltAt: Date.now(),
        },
        completeness: {
          score: 1.0,
          isComplete: true,
          missingSections: [],
          degradedSections: [],
        },
        freshness: {
          status: 'CURRENT',
          lastCheckedAt: Date.now(),
          stalenessReasons: [],
        },
        confidence: 0.95,
      } as any,
    };
  }

  public async getFeatureSummary(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeSummary> {
    return {
      featureId,
      name: `Feature ${featureId}`,
      status: 'STABLE',
      dependencyCount: 2,
      healthScore: 0.9,
    } as unknown as FeatureKnowledgeSummary;
  }

  public async getFeatureMappings(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureMappingSection> {
    return {
      status: 'AVAILABLE',
      itemCount: 1,
      data: {
        totalMappings: 1,
        codeMappings: [],
        documentationMappings: [],
        endpointMappings: [],
        configurationMappings: [],
        testMappings: [],
        databaseMappings: [],
        symbolMappings: [],
        moduleMappings: [],
        uiMappings: [],
        sharedResources: [],
      },
    } as unknown as FeatureMappingSection;
  }

  public async getFeatureDependencies(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureDependencySection> {
    return {
      status: 'AVAILABLE',
      itemCount: 1,
      data: {
        dependencies: [{ targetFeatureId: 'dep_feature', dependencyType: 'USES', strength: 1.0 }],
        circularDependencies: [],
        directDependencyCount: 1,
        transitiveDependencyCount: 0,
      },
    } as unknown as FeatureDependencySection;
  }

  public async getFeatureDependents(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureDependencySection> {
    return {
      status: 'AVAILABLE',
      itemCount: 1,
      data: {
        dependencies: [{ targetFeatureId: 'consumer_feature', dependencyType: 'USES', strength: 1.0 }],
        circularDependencies: [],
        directDependencyCount: 1,
        transitiveDependencyCount: 0,
      },
    } as unknown as FeatureDependencySection;
  }

  public async getFeatureBehavior(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureBehaviorSection> {
    return {
      status: 'AVAILABLE',
      itemCount: 1,
      data: {
        flows: [],
        dataFlows: [],
        eventFlows: [],
        conflictPoints: [],
        flowCount: 1,
      },
    } as unknown as FeatureBehaviorSection;
  }

  public async getFeatureHealth(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureHealthSection> {
    return {
      status: 'AVAILABLE',
      itemCount: 1,
      data: {
        healthScore: 0.95,
        healthStatus: 'HEALTHY',
        criticalityScore: 0.5,
        criticalityLevel: 'MEDIUM',
        risks: [],
      },
    } as unknown as FeatureHealthSection;
  }

  public async getFeatureImpact(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureImpactSection> {
    return {
      status: 'AVAILABLE',
      itemCount: 1,
      data: {
        impactRadius: 1,
        impactScore: 0.2,
        impactedFeatures: [
          {
            targetId: 'feature_b',
            targetType: 'FEATURE',
            severity: 'LOW',
            impactType: 'CALLS',
            score: 0.2,
            distance: 1,
          },
        ],
        impactedResources: [],
        propagationPathsCount: 1,
      },
    } as unknown as FeatureImpactSection;
  }

  public async getFeatureHistory(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureHistorySection> {
    return {
      status: 'AVAILABLE',
      itemCount: 3,
      data: {
        firstSeenAt: Date.now() - 100000,
        lastUpdatedAt: Date.now(),
        versionCount: 3,
        maturityLevel: 'STABLE',
        milestones: [],
        trends: [],
        recentEventsCount: 3,
        regressionsCount: 0,
      },
    } as unknown as FeatureHistorySection;
  }

  public async getFeatureArchitecture(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureArchitectureSection> {
    return {
      status: 'AVAILABLE',
      itemCount: 2,
      data: {
        patterns: ['DependencyInjection'],
        components: ['AuthService', 'TokenValidator'],
      },
    } as unknown as FeatureArchitectureSection;
  }

  public async getFeatureContext(
    featureId: string,
    _options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeContextPackage> {
    return {
      featureId,
      packageId: 'ctx_pkg_1',
      generatedAt: Date.now(),
      sections: [],
    } as unknown as FeatureKnowledgeContextPackage;
  }

  public async explainFeatureKnowledge(
    query: FeatureKnowledgeQuery
  ): Promise<Record<string, string>> {
    return { [query.featureId]: 'Explanation' };
  }

  public async getKnowledgeCompleteness(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeCompleteness> {
    return {
      score: 1.0,
      isComplete: true,
      missingSections: [],
      degradedSections: [],
    } as unknown as FeatureKnowledgeCompleteness;
  }

  public async getKnowledgeFreshness(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeFreshness> {
    return {
      status: 'CURRENT',
      lastCheckedAt: Date.now(),
      stalenessReasons: [],
    } as unknown as FeatureKnowledgeFreshness;
  }

  public async getKnowledgeVersionStatus(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeVersion> {
    return {
      versionString: '1.0',
      isStale: false,
      staleReasons: [],
      lastRebuiltAt: Date.now(),
    } as unknown as FeatureKnowledgeVersion;
  }
}

export function createTestSetup() {
  const eventBus = new MockEventBus();
  const contextOrchestrator = new MockContextOrchestrator();
  const featureKnowledgeApi = new MockFeatureKnowledgeAPI();

  const runtime = AgentDISetup.createRuntime({
    contextOrchestrator,
    featureKnowledgeApi,
    eventBus,
  });

  return {
    eventBus,
    contextOrchestrator,
    featureKnowledgeApi,
    runtime,
  };
}

export function createTestRequest<T = unknown>(
  operation: AgentOperationType,
  payload: T,
  overrides?: Partial<AgentRequest<T>>
): AgentRequest<T> {
  return {
    requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    protocolVersion: CURRENT_AGENT_PROTOCOL_VERSION,
    operation,
    agentId: 'test_agent',
    workspaceContext: {
      workspaceId: 'ws_main',
      repositoryId: 'repo_alpha',
    },
    payload,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createAllCapabilities(): AgentCapabilitySet {
  return new AgentCapabilitySet(AGENT_CAPABILITIES);
}
