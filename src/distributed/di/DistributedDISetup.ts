import type { DIContainer } from '../../workspace/di/DIContainer.js';
import type { DistributedConfig } from '../models/DistributedConfig.js';
import { DEFAULT_DISTRIBUTED_CONFIG } from '../models/DistributedConfig.js';
import { CoordinationBackendFactory } from '../coordination/CoordinationBackendFactory.js';
import { IDistributedCoordinationBackendToken } from '../coordination/IDistributedCoordinationBackend.js';
import { DistributedLockManager } from '../locking/DistributedLockManager.js';
import { IDistributedLockManagerToken } from '../locking/IDistributedLockManager.js';
import { FencingGuard } from '../locking/FencingGuard.js';
import { DistributedServiceDiscovery } from '../discovery/DistributedServiceDiscovery.js';
import { IDistributedServiceDiscoveryToken } from '../discovery/IDistributedServiceDiscovery.js';
import { DistributedRuntimeLifecycle } from '../lifecycle/DistributedRuntimeLifecycle.js';
import { DistributedEventBus } from '../events/DistributedEventBus.js';
import { IEventBusToken } from '../../workspace/interfaces/IEventBus.js';

export const DistributedConfigToken = Symbol.for('DistributedConfig');
export const FencingGuardToken = Symbol.for('FencingGuard');
export const DistributedRuntimeLifecycleToken = Symbol.for('DistributedRuntimeLifecycle');

export class DistributedDISetup {
  public static configure(
    container: DIContainer,
    config: Partial<DistributedConfig> = {}
  ): void {
    const fullConfig: DistributedConfig = {
      ...DEFAULT_DISTRIBUTED_CONFIG,
      ...config,
    };

    container.registerInstance(DistributedConfigToken, fullConfig);

    // Fencing guard singleton
    const fencingGuard = new FencingGuard();
    container.registerInstance(FencingGuardToken, fencingGuard);

    // Coordination backend
    const backend = CoordinationBackendFactory.create(fullConfig);
    container.registerInstance(IDistributedCoordinationBackendToken, backend);

    // Distributed lock manager
    const lockManager = new DistributedLockManager(
      backend,
      {
        ownerId: fullConfig.instanceId,
        defaultTtlMs: fullConfig.defaultLockTtlMs,
        defaultWaitTimeoutMs: fullConfig.acquireTimeoutMs,
        defaultRetryIntervalMs: fullConfig.retryIntervalMs,
      },
      fencingGuard
    );
    container.registerInstance(IDistributedLockManagerToken, lockManager);

    // Distributed service discovery
    const discovery = new DistributedServiceDiscovery(backend, fullConfig);
    container.registerInstance(IDistributedServiceDiscoveryToken, discovery);

    // Distributed runtime lifecycle
    const lifecycle = new DistributedRuntimeLifecycle(
      fullConfig,
      backend,
      lockManager,
      discovery
    );
    container.registerInstance(DistributedRuntimeLifecycleToken, lifecycle);

    // Distributed event bus (wraps existing IEventBus if available)
    if (fullConfig.distributedEventsEnabled) {
      const existingLocalBus = container.hasRegistration(IEventBusToken)
        ? (container.resolve(IEventBusToken) as any)
        : null;

      if (existingLocalBus) {
        const distBus = new DistributedEventBus(
          existingLocalBus,
          discovery.getInstanceId(),
          backend
        );
        container.registerInstance(IEventBusToken, distBus);
      }
    }
  }
}
