import type { DIContainer } from '../../../workspace/di/DIContainer.js';
import { KnowledgeUpdateTokens } from './KnowledgeUpdateTokens.js';
import { InMemoryKnowledgeUpdateRepository } from '../core/InMemoryKnowledgeUpdateRepository.js';
import { KnowledgeUpdateNormalizer } from '../core/KnowledgeUpdateNormalizer.js';
import { KnowledgeUpdateDeduplicator } from '../core/KnowledgeUpdateDeduplicator.js';
import { KnowledgeUpdateValidator } from '../core/KnowledgeUpdateValidator.js';
import { KnowledgeImpactResolver } from '../core/KnowledgeImpactResolver.js';
import { KnowledgeUpdatePlanner } from '../core/KnowledgeUpdatePlanner.js';
import { KnowledgeUpdateExecutor } from '../core/KnowledgeUpdateExecutor.js';
import { KnowledgeVersionManager } from '../core/KnowledgeVersionManager.js';
import { KnowledgeInvalidationManager } from '../core/KnowledgeInvalidationManager.js';
import { KnowledgeRefreshManager } from '../core/KnowledgeRefreshManager.js';
import { KnowledgeUpdateRunManager } from '../core/KnowledgeUpdateRunManager.js';
import { KnowledgeUpdateExplainer } from '../core/KnowledgeUpdateExplainer.js';
import { KnowledgeUpdateProcessor } from '../core/KnowledgeUpdateProcessor.js';
import { KnowledgeUpdateCoordinator } from '../core/KnowledgeUpdateCoordinator.js';

import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { IFeatureMappingEngine } from '../../features/mapping/interfaces/IFeatureMappingEngine.js';
import type { IFeatureDependencyEngine } from '../../features/dependencies/interfaces/IFeatureDependencyEngine.js';
import type { IFeatureBehaviorEngine } from '../../features/behavior/interfaces/IFeatureBehaviorEngine.js';
import type { IFeatureHealthEngine } from '../../features/health/interfaces/IFeatureHealthEngine.js';
import type { IFeatureImpactEngine } from '../../features/impact/interfaces/IFeatureImpactEngine.js';
import type { IFeatureHistoryEngine } from '../../features/history/interfaces/IFeatureHistoryEngine.js';
import type { IFeatureRegistry } from '../../features/interfaces/IFeatureRegistry.js';
import type { IAgentContextSessionManager } from '../../../agent/context/interfaces/IAgentContextSessionManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';

export interface KnowledgeUpdateDISetupDependencies {
  readonly repository?: IKnowledgeUpdateRepository | undefined;
  readonly mappingEngine?: IFeatureMappingEngine | undefined;
  readonly dependencyEngine?: IFeatureDependencyEngine | undefined;
  readonly behaviorEngine?: IFeatureBehaviorEngine | undefined;
  readonly healthEngine?: IFeatureHealthEngine | undefined;
  readonly impactEngine?: IFeatureImpactEngine | undefined;
  readonly historyEngine?: IFeatureHistoryEngine | undefined;
  readonly featureRegistry?: IFeatureRegistry | undefined;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export class KnowledgeUpdateDISetup {
  public static register(container: DIContainer, deps: KnowledgeUpdateDISetupDependencies = {}): void {
    // 1. Repository
    const repository = deps.repository ?? new InMemoryKnowledgeUpdateRepository();
    container.registerFactory(KnowledgeUpdateTokens.Repository, () => repository, 'Singleton');

    // 2. Normalizer & Deduplicator & Validator
    const normalizer = new KnowledgeUpdateNormalizer();
    container.registerFactory(KnowledgeUpdateTokens.Normalizer, () => normalizer, 'Singleton');

    const deduplicator = new KnowledgeUpdateDeduplicator(repository);
    container.registerFactory(KnowledgeUpdateTokens.Deduplicator, () => deduplicator, 'Singleton');

    const validator = new KnowledgeUpdateValidator();
    container.registerFactory(KnowledgeUpdateTokens.Validator, () => validator, 'Singleton');

    // 3. ImpactResolver
    const impactResolver = new KnowledgeImpactResolver({
      mappingEngine: deps.mappingEngine,
      dependencyEngine: deps.dependencyEngine,
      featureRegistry: deps.featureRegistry,
    });
    container.registerFactory(KnowledgeUpdateTokens.ImpactResolver, () => impactResolver, 'Singleton');

    // 4. Planner
    const planner = new KnowledgeUpdatePlanner(impactResolver);
    container.registerFactory(KnowledgeUpdateTokens.Planner, () => planner, 'Singleton');

    // 5. Executor
    const executor = new KnowledgeUpdateExecutor({
      mappingEngine: deps.mappingEngine,
      dependencyEngine: deps.dependencyEngine,
      behaviorEngine: deps.behaviorEngine,
      healthEngine: deps.healthEngine,
      impactEngine: deps.impactEngine,
      historyEngine: deps.historyEngine,
    });
    container.registerFactory(KnowledgeUpdateTokens.Executor, () => executor, 'Singleton');

    // 6. VersionManager
    const versionManager = new KnowledgeVersionManager(repository);
    container.registerFactory(KnowledgeUpdateTokens.VersionManager, () => versionManager, 'Singleton');

    // 7. InvalidationManager
    const invalidationManager = new KnowledgeInvalidationManager(repository, deps.eventBus);
    container.registerFactory(KnowledgeUpdateTokens.InvalidationManager, () => invalidationManager, 'Singleton');

    // 8. RefreshManager
    const refreshManager = new KnowledgeRefreshManager({
      repository,
      contextSessionManager: deps.contextSessionManager,
      eventBus: deps.eventBus,
    });
    container.registerFactory(KnowledgeUpdateTokens.RefreshManager, () => refreshManager, 'Singleton');

    // 9. RunManager & Explainer
    const runManager = new KnowledgeUpdateRunManager(repository);
    container.registerFactory(KnowledgeUpdateTokens.RunManager, () => runManager, 'Singleton');

    const explainer = new KnowledgeUpdateExplainer();
    container.registerFactory(KnowledgeUpdateTokens.Explainer, () => explainer, 'Singleton');

    // 10. Processor
    const processor = new KnowledgeUpdateProcessor({
      repository,
      executor,
      versionManager,
      invalidationManager,
      refreshManager,
      eventBus: deps.eventBus,
    });
    container.registerFactory(KnowledgeUpdateTokens.Processor, () => processor, 'Singleton');

    // 11. Coordinator
    const coordinator = new KnowledgeUpdateCoordinator({
      repository,
      normalizer,
      validator,
      deduplicator,
      planner,
      processor,
      versionManager,
      runManager,
      explainer,
      eventBus: deps.eventBus,
    });
    container.registerFactory(KnowledgeUpdateTokens.Coordinator, () => coordinator, 'Singleton');
  }
}
