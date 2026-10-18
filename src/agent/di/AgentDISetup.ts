import type { DIContainer } from '../../workspace/di/DIContainer.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import { AgentTokens } from './AgentTokens.js';
import { AgentRegistry } from '../runtime/AgentRegistry.js';
import { AgentSessionManager } from '../runtime/AgentSessionManager.js';
import { AgentCapabilityResolver } from '../runtime/AgentCapabilityResolver.js';
import { AgentOperationRouter } from '../runtime/AgentOperationRouter.js';
import { AgentRuntime } from '../runtime/AgentRuntime.js';
import { AdapterRegistry } from '../adapters/AdapterRegistry.js';

// Operation Handlers
import { GetContextHandler } from '../handlers/GetContextHandler.js';
import { GetFeatureHandler } from '../handlers/GetFeatureHandler.js';
import { GetFeatureContextHandler } from '../handlers/GetFeatureContextHandler.js';
import { GetImpactHandler } from '../handlers/GetImpactHandler.js';
import { GetArchitectureHandler } from '../handlers/GetArchitectureHandler.js';
import { GetHistoryHandler } from '../handlers/GetHistoryHandler.js';
import { GetHealthHandler } from '../handlers/GetHealthHandler.js';
import { ExplainContextHandler } from '../handlers/ExplainContextHandler.js';
import { RefreshContextHandler } from '../handlers/RefreshContextHandler.js';
import { ReportExecutionHandler } from '../handlers/ReportExecutionHandler.js';
import { ReportVerificationHandler } from '../handlers/ReportVerificationHandler.js';
import { UpdateKnowledgeHandler } from '../handlers/UpdateKnowledgeHandler.js';
import { AgentAdapterDISetup } from '../adapters/di/AgentAdapterDISetup.js';

export interface AgentIntegrationDependencies {
  readonly contextOrchestrator: IContextOrchestrator;
  readonly featureKnowledgeApi: IFeatureKnowledgeAPI;
  readonly eventBus?: IEventBus | undefined;
}

export class AgentDISetup {
  public static register(container: DIContainer, deps: AgentIntegrationDependencies): void {
    // 0. Agent Adapters
    AgentAdapterDISetup.register(container, { eventBus: deps.eventBus });

    // 1. Core Runtime Services
    container.registerFactory(
      AgentTokens.IAgentRegistry,
      () => new AgentRegistry(deps.eventBus),
      'Singleton'
    );

    container.registerFactory(
      AgentTokens.IAgentSessionManager,
      () => new AgentSessionManager(deps.eventBus),
      'Singleton'
    );

    container.registerFactory(
      AgentTokens.IAgentCapabilityResolver,
      () => new AgentCapabilityResolver(),
      'Singleton'
    );

    container.registerFactory(
      AgentTokens.IAdapterRegistry,
      () => new AdapterRegistry(),
      'Singleton'
    );

    // 2. Handlers
    container.registerFactory(
      AgentTokens.GetContextHandler,
      () => new GetContextHandler(deps.contextOrchestrator),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.GetFeatureHandler,
      () => new GetFeatureHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.GetFeatureContextHandler,
      () => new GetFeatureContextHandler(deps.contextOrchestrator),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.GetImpactHandler,
      () => new GetImpactHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.GetArchitectureHandler,
      () => new GetArchitectureHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.GetHistoryHandler,
      () => new GetHistoryHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.GetHealthHandler,
      () => new GetHealthHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.ExplainContextHandler,
      () => new ExplainContextHandler(deps.contextOrchestrator),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.RefreshContextHandler,
      () => new RefreshContextHandler(deps.contextOrchestrator),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.ReportExecutionHandler,
      () => new ReportExecutionHandler(deps.eventBus),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.ReportVerificationHandler,
      () => new ReportVerificationHandler(deps.eventBus),
      'Singleton'
    );
    container.registerFactory(
      AgentTokens.UpdateKnowledgeHandler,
      () => new UpdateKnowledgeHandler(deps.eventBus),
      'Singleton'
    );

    // 3. Router Wiring
    container.registerFactory(
      AgentTokens.IAgentOperationRouter,
      (c) => {
        const router = new AgentOperationRouter();
        router.registerHandler(c.resolve(AgentTokens.GetContextHandler));
        router.registerHandler(c.resolve(AgentTokens.GetFeatureHandler));
        router.registerHandler(c.resolve(AgentTokens.GetFeatureContextHandler));
        router.registerHandler(c.resolve(AgentTokens.GetImpactHandler));
        router.registerHandler(c.resolve(AgentTokens.GetArchitectureHandler));
        router.registerHandler(c.resolve(AgentTokens.GetHistoryHandler));
        router.registerHandler(c.resolve(AgentTokens.GetHealthHandler));
        router.registerHandler(c.resolve(AgentTokens.ExplainContextHandler));
        router.registerHandler(c.resolve(AgentTokens.RefreshContextHandler));
        router.registerHandler(c.resolve(AgentTokens.ReportExecutionHandler));
        router.registerHandler(c.resolve(AgentTokens.ReportVerificationHandler));
        router.registerHandler(c.resolve(AgentTokens.UpdateKnowledgeHandler));
        return router;
      },
      'Singleton'
    );

    // 4. Runtime
    container.registerFactory(
      AgentTokens.IAgentRuntime,
      (c) =>
        new AgentRuntime({
          registry: c.resolve(AgentTokens.IAgentRegistry),
          sessionManager: c.resolve(AgentTokens.IAgentSessionManager),
          capabilityResolver: c.resolve(AgentTokens.IAgentCapabilityResolver),
          router: c.resolve(AgentTokens.IAgentOperationRouter),
          eventBus: deps.eventBus,
        }),
      'Singleton'
    );
  }

  /**
   * Helper factory to instantiate a fully-wired AgentRuntime without requiring DI container setup.
   */
  public static createRuntime(deps: AgentIntegrationDependencies): AgentRuntime {
    const registry = new AgentRegistry(deps.eventBus);
    const sessionManager = new AgentSessionManager(deps.eventBus);
    const capabilityResolver = new AgentCapabilityResolver();
    const router = new AgentOperationRouter();

    router.registerHandler(new GetContextHandler(deps.contextOrchestrator));
    router.registerHandler(new GetFeatureHandler(deps.featureKnowledgeApi));
    router.registerHandler(new GetFeatureContextHandler(deps.contextOrchestrator));
    router.registerHandler(new GetImpactHandler(deps.featureKnowledgeApi));
    router.registerHandler(new GetArchitectureHandler(deps.featureKnowledgeApi));
    router.registerHandler(new GetHistoryHandler(deps.featureKnowledgeApi));
    router.registerHandler(new GetHealthHandler(deps.featureKnowledgeApi));
    router.registerHandler(new ExplainContextHandler(deps.contextOrchestrator));
    router.registerHandler(new RefreshContextHandler(deps.contextOrchestrator));
    router.registerHandler(new ReportExecutionHandler(deps.eventBus));
    router.registerHandler(new ReportVerificationHandler(deps.eventBus));
    router.registerHandler(new UpdateKnowledgeHandler(deps.eventBus));

    return new AgentRuntime({
      registry,
      sessionManager,
      capabilityResolver,
      router,
      eventBus: deps.eventBus,
    });
  }
}
