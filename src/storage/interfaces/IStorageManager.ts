import { StorageProviderType } from '../types/StorageTypes';
import type { IStorageProvider } from './IStorageProvider';

export interface IStorageManager {
  /**
   * Registers a new provider into the system.
   */
  registerProvider(provider: IStorageProvider): void;
  
  /**
   * Orchestrates the initialization of all registered providers.
   */
  initializeAll(): Promise<void>;

  /**
   * Retrieves the factory for dependency injection in other modules.
   */
  getFactory(): any; // Return type will be IStorageFactory
}

export const IStorageManagerToken = Symbol('IStorageManager');
