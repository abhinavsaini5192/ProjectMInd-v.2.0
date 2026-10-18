import type { IStorageFactory } from '../interfaces/IStorageFactory';
import type { IStorageProvider } from '../interfaces/IStorageProvider';
import { StorageProviderType } from '../types/StorageTypes';
import type { StorageContext } from '../models/StorageContext';
import { StorageProviderRegistry } from './StorageProviderRegistry';
import { ProviderResolutionError } from '../types/StorageErrors';
import type { ILogger } from '../../workspace/interfaces/ILogger';

export class StorageFactory implements IStorageFactory {
  constructor(
    private registry: StorageProviderRegistry,
    private logger: ILogger
  ) {}

  getProviderByName(name: string, context?: StorageContext): IStorageProvider {
    const provider = this.registry.getByName(name);
    if (!provider) {
      this.logger.error({
        component: 'StorageFactory',
        operation: 'getProviderByName',
        message: `Provider '${name}' not found.`,
        details: { context }
      });
      throw new ProviderResolutionError(`Storage provider '${name}' is not registered.`);
    }
    return provider;
  }

  getProviderByType(type: StorageProviderType, context?: StorageContext): IStorageProvider {
    const provider = this.registry.getByType(type);
    if (!provider) {
      this.logger.error({
        component: 'StorageFactory',
        operation: 'getProviderByType',
        message: `No default provider found for type '${type}'.`,
        details: { context }
      });
      throw new ProviderResolutionError(`No storage provider registered for type '${type}'.`);
    }
    return provider;
  }
}

export { IStorageFactoryToken } from '../interfaces/IStorageFactory';
