import type { IStorageManager } from '../interfaces/IStorageManager';
import type { IStorageProvider } from '../interfaces/IStorageProvider';
import { StorageProviderRegistry } from './StorageProviderRegistry';
import { StorageFactory } from './StorageFactory';
import { StorageLifecycleManager } from './StorageLifecycleManager';
import { StorageValidator } from './StorageValidator';
import type { IEventBus } from '../../workspace/interfaces/IEventBus';
import type { ILogger } from '../../workspace/interfaces/ILogger';
import { StorageEvents } from '../types/StorageEvents';

export class StorageManager implements IStorageManager {
  constructor(
    private registry: StorageProviderRegistry,
    private factory: StorageFactory,
    private lifecycle: StorageLifecycleManager,
    private validator: StorageValidator,
    private eventBus: IEventBus,
    private logger: ILogger
  ) {}

  registerProvider(provider: IStorageProvider): void {
    this.logger.info({ component: 'StorageManager', operation: 'registerProvider', message: `Registering provider ${provider.name}` });
    this.validator.validateProvider(provider);
    this.registry.register(provider);
    this.eventBus.publish(StorageEvents.ProviderRegistered, { providerName: provider.name, type: provider.type });
  }

  async initializeAll(): Promise<void> {
    this.logger.info({ component: 'StorageManager', operation: 'initializeAll', message: 'Initializing all registered providers' });
    const providers = this.registry.getAll();
    
    for (const provider of providers) {
      await this.lifecycle.initialize(provider);
      await this.lifecycle.start(provider);
    }
  }

  getFactory(): StorageFactory {
    return this.factory;
  }
}
