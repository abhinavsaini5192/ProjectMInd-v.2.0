import { StorageProviderType, ProviderState } from '../types/StorageTypes';
import type { StorageConfiguration } from '../models/StorageConfiguration';
import type { StorageHealth } from '../models/StorageHealth';
import type { StorageStatistics } from '../models/StorageStatistics';

export interface IStorageProvider {
  /** Uniquely identifies the provider implementation (e.g., 'sqlite', 'kuzu') */
  readonly name: string;
  
  /** The category of storage this provider implements */
  readonly type: StorageProviderType;
  
  /** Current state of the provider */
  readonly state: ProviderState;

  initialize(config: StorageConfiguration): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;

  healthCheck(): Promise<StorageHealth>;
  getStatistics(): Promise<StorageStatistics>;
  
  backup(destinationPath: string): Promise<void>;
  restore(sourcePath: string): Promise<void>;
  migrate(targetVersion: string): Promise<void>;
}

export const IStorageProviderToken = Symbol('IStorageProvider');
