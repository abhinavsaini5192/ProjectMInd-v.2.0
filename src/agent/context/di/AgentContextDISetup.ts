import type { DIContainer } from '../../../workspace/di/DIContainer.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { AgentContextTokens } from './AgentContextTokens.js';
import { InMemoryAgentContextStore } from '../services/InMemoryAgentContextStore.js';
import { AgentContextPinManager } from '../services/AgentContextPinManager.js';
import { AgentContextDeltaCalculator } from '../services/AgentContextDeltaCalculator.js';
import { AgentContextInvalidator } from '../services/AgentContextInvalidator.js';
import { AgentContextRefresher } from '../services/AgentContextRefresher.js';
import { AgentContextSessionManager } from '../services/AgentContextSessionManager.js';

export interface AgentContextDependencies {
  readonly contextOrchestrator: IContextOrchestrator;
  readonly featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined;
  readonly sessionManager?: IAgentSessionManager | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export function createAgentContextSessionManager(
  deps: AgentContextDependencies
): AgentContextSessionManager {
  const store = new InMemoryAgentContextStore();
  const pinManager = new AgentContextPinManager(store);
  const deltaCalculator = new AgentContextDeltaCalculator();
  const invalidator = new AgentContextInvalidator(deps.featureKnowledgeApi);
  const refresher = new AgentContextRefresher(deps.contextOrchestrator);

  return new AgentContextSessionManager({
    store,
    pinManager,
    deltaCalculator,
    invalidator,
    refresher,
    contextOrchestrator: deps.contextOrchestrator,
    sessionManager: deps.sessionManager,
    eventBus: deps.eventBus,
  });
}

export class AgentContextDISetup {
  public static register(container: DIContainer, deps: AgentContextDependencies): void {
    const store = new InMemoryAgentContextStore();
    const pinManager = new AgentContextPinManager(store);
    const deltaCalculator = new AgentContextDeltaCalculator();
    const invalidator = new AgentContextInvalidator(deps.featureKnowledgeApi);
    const refresher = new AgentContextRefresher(deps.contextOrchestrator);

    container.registerFactory(AgentContextTokens.IAgentContextStore, () => store, 'Singleton');
    container.registerFactory(AgentContextTokens.IAgentContextPinManager, () => pinManager, 'Singleton');
    container.registerFactory(AgentContextTokens.IAgentContextDeltaCalculator, () => deltaCalculator, 'Singleton');
    container.registerFactory(AgentContextTokens.IAgentContextInvalidator, () => invalidator, 'Singleton');
    container.registerFactory(AgentContextTokens.IAgentContextRefresher, () => refresher, 'Singleton');

    container.registerFactory(
      AgentContextTokens.IAgentContextSessionManager,
      () =>
        new AgentContextSessionManager({
          store,
          pinManager,
          deltaCalculator,
          invalidator,
          refresher,
          contextOrchestrator: deps.contextOrchestrator,
          sessionManager: deps.sessionManager,
          eventBus: deps.eventBus,
        }),
      'Singleton'
    );
  }
}
