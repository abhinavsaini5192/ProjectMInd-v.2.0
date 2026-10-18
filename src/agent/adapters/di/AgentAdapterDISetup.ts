import type { DIContainer } from '../../../workspace/di/DIContainer.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { AgentAdapterTokens } from './AgentAdapterTokens.js';
import { AgentAdapterRegistry } from '../core/AgentAdapterRegistry.js';
import { AgentAdapterResolver } from '../core/AgentAdapterResolver.js';
import { AgentCapabilityMapper } from '../core/AgentCapabilityMapper.js';
import { AgentToolMapper } from '../core/AgentToolMapper.js';
import { AgentContextMapper } from '../core/AgentContextMapper.js';
import { AgentSessionMapper } from '../core/AgentSessionMapper.js';
import { AgentProtocolTranslator } from '../core/AgentProtocolTranslator.js';
import { AgentAdapterValidator } from '../core/AgentAdapterValidator.js';
import { AgentAdapterManager } from '../core/AgentAdapterManager.js';

import { GenericAgentAdapter } from '../generic/GenericAgentAdapter.js';
import { McpAgentAdapter } from '../mcp/McpAgentAdapter.js';
import { GenericCliAdapter } from '../cli/GenericCliAdapter.js';
import { IdeAgentAdapter } from '../ide/IdeAgentAdapter.js';

export interface AgentAdapterDependencies {
  readonly eventBus?: IEventBus | undefined;
}

export class AgentAdapterDISetup {
  public static register(container: DIContainer, deps: AgentAdapterDependencies = {}): void {
    // 1. Core Services
    container.registerFactory(
      AgentAdapterTokens.IAgentAdapterRegistry,
      () => new AgentAdapterRegistry(deps.eventBus),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentCapabilityMapper,
      () => new AgentCapabilityMapper(),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentToolMapper,
      () => new AgentToolMapper(),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentContextMapper,
      () => new AgentContextMapper(),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentSessionMapper,
      () => new AgentSessionMapper(),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentProtocolTranslator,
      () => new AgentProtocolTranslator(),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentAdapterValidator,
      () => new AgentAdapterValidator(),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentAdapterResolver,
      (c) =>
        new AgentAdapterResolver(
          c.resolve(AgentAdapterTokens.IAgentAdapterRegistry),
          c.resolve(AgentAdapterTokens.IAgentCapabilityMapper),
          deps.eventBus
        ),
      'Singleton'
    );

    container.registerFactory(
      AgentAdapterTokens.IAgentAdapterManager,
      (c) =>
        new AgentAdapterManager(
          c.resolve(AgentAdapterTokens.IAgentAdapterRegistry),
          c.resolve(AgentAdapterTokens.IAgentAdapterResolver),
          c.resolve(AgentAdapterTokens.IAgentAdapterValidator),
          c.resolve(AgentAdapterTokens.IAgentProtocolTranslator),
          deps.eventBus
        ),
      'Singleton'
    );

    // 2. Concrete Reference Adapters
    container.registerFactory(
      AgentAdapterTokens.GenericAgentAdapter,
      () => new GenericAgentAdapter(),
      'Transient'
    );

    container.registerFactory(
      AgentAdapterTokens.McpAgentAdapter,
      () => new McpAgentAdapter(),
      'Transient'
    );

    container.registerFactory(
      AgentAdapterTokens.GenericCliAdapter,
      () => new GenericCliAdapter(),
      'Transient'
    );

    container.registerFactory(
      AgentAdapterTokens.IdeAgentAdapter,
      () => new IdeAgentAdapter(),
      'Transient'
    );
  }
}
