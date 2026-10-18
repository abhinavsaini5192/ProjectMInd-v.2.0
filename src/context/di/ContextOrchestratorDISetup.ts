import type { DIContainer } from '../../workspace/di/DIContainer.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IFeatureRepository } from '../../knowledge/features/interfaces/IFeatureRepository.js';
import type { IFeatureMappingRepository } from '../../knowledge/features/mapping/interfaces/IFeatureMappingRepository.js';
import { ContextTokens } from './ContextOrchestratorTokens.js';
import { ContextPlanner } from '../planning/ContextPlanner.js';
import { ContextRetrievalCoordinator } from '../retrieval/ContextRetrievalCoordinator.js';
import { ContextSelector } from '../selection/ContextSelector.js';
import { TokenBudgetManager } from '../budgeting/TokenBudgetManager.js';
import { ContextPackageBuilder } from '../packing/ContextPackageBuilder.js';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';
import { ContextExplanationService } from '../orchestrator/ContextExplanationService.js';
import { ContextCache } from '../cache/ContextCache.js';
import { ContextOrchestrator } from '../orchestrator/ContextOrchestrator.js';
import { ContextProvider } from '../provider/ContextProvider.js';

export interface ContextOrchestratorDependencies {
  featureKnowledgeApi: IFeatureKnowledgeAPI;
  featureRepository?: IFeatureRepository | undefined;
  mappingRepository?: IFeatureMappingRepository | undefined;
}

export class ContextOrchestratorDISetup {
  public static register(container: DIContainer, deps: ContextOrchestratorDependencies): void {
    container.registerFactory(ContextTokens.IContextPlanner, () => new ContextPlanner(), 'Singleton');
    container.registerFactory(
      ContextTokens.IContextRetriever,
      () => new ContextRetrievalCoordinator(deps.featureKnowledgeApi, deps.featureRepository, deps.mappingRepository),
      'Singleton'
    );
    container.registerFactory(ContextTokens.IContextSelector, () => new ContextSelector(), 'Singleton');
    container.registerFactory(ContextTokens.ITokenBudgetManager, () => new TokenBudgetManager(), 'Singleton');
    container.registerFactory(ContextTokens.IContextPacker, () => new ContextPackageBuilder(), 'Singleton');
    container.registerFactory(ContextTokens.AdapterRegistry, () => new AdapterRegistry(), 'Singleton');
    container.registerFactory(ContextTokens.IContextExplanationService, () => new ContextExplanationService(), 'Singleton');
    container.registerFactory(ContextTokens.ContextCache, () => new ContextCache(), 'Singleton');

    container.registerFactory(
      ContextTokens.IContextOrchestrator,
      (c) =>
        new ContextOrchestrator(
          c.resolve(ContextTokens.IContextRetriever),
          c.resolve(ContextTokens.IContextPlanner),
          c.resolve(ContextTokens.IContextSelector),
          c.resolve(ContextTokens.ITokenBudgetManager),
          c.resolve(ContextTokens.IContextPacker),
          c.resolve(ContextTokens.AdapterRegistry),
          c.resolve(ContextTokens.IContextExplanationService),
          c.resolve(ContextTokens.ContextCache)
        ),
      'Singleton'
    );

    container.registerFactory(
      ContextTokens.IContextProvider,
      (c) => new ContextProvider(c.resolve(ContextTokens.IContextOrchestrator)),
      'Singleton'
    );
  }
}
