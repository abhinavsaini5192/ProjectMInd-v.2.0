import { DIContainer } from '../../workspace/di/DIContainer.js';
import { ILoggerToken, type ILogger } from '../../workspace/interfaces/ILogger.js';

import { SQLiteRegistryStore } from './providers/SQLiteRegistryStore.js';
import { SQLiteMemoryStore } from './providers/SQLiteMemoryStore.js';
import { SQLiteMetadataStore } from './providers/SQLiteMetadataStore.js';
import { SQLiteCacheStore } from './providers/SQLiteCacheStore.js';
import { SQLiteSettingsStore } from './providers/SQLiteSettingsStore.js';

export const SQLiteTokens = {
  RegistryStore: Symbol.for('SQLiteRegistryStore'),
  MemoryStore: Symbol.for('SQLiteMemoryStore'),
  MetadataStore: Symbol.for('SQLiteMetadataStore'),
  CacheStore: Symbol.for('SQLiteCacheStore'),
  SettingsStore: Symbol.for('SQLiteSettingsStore'),
} as const;

export class SQLiteBootstrap {
  static configure(container: DIContainer, databaseDirectory: string): void {
    container.registerFactory(SQLiteTokens.RegistryStore, (c: DIContainer) => {
      return new SQLiteRegistryStore(`${databaseDirectory}/registry.db`, c.resolve(ILoggerToken) as ILogger);
    });

    container.registerFactory(SQLiteTokens.MemoryStore, (c: DIContainer) => {
      return new SQLiteMemoryStore(`${databaseDirectory}/memory.db`, c.resolve(ILoggerToken) as ILogger);
    });

    container.registerFactory(SQLiteTokens.MetadataStore, (c: DIContainer) => {
      return new SQLiteMetadataStore(`${databaseDirectory}/metadata.db`, c.resolve(ILoggerToken) as ILogger);
    });

    container.registerFactory(SQLiteTokens.CacheStore, (c: DIContainer) => {
      return new SQLiteCacheStore(`${databaseDirectory}/cache.db`, c.resolve(ILoggerToken) as ILogger);
    });

    container.registerFactory(SQLiteTokens.SettingsStore, (c: DIContainer) => {
      return new SQLiteSettingsStore(`${databaseDirectory}/settings.db`, c.resolve(ILoggerToken) as ILogger);
    });
  }
}
