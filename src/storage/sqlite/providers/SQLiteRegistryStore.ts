import { SQLiteProvider } from '../core/SQLiteProvider.js';
import { StorageProviderType } from '../../types/StorageTypes.js';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';

export class SQLiteRegistryStore extends SQLiteProvider {
  constructor(dbPath: string, logger: ILogger) {
    super('sqlite-registry', StorageProviderType.Registry, dbPath, logger);
  }

  protected getInitialSchema(): string {
    return 'CREATE TABLE IF NOT EXISTS repositories (id TEXT PRIMARY KEY, path TEXT NOT NULL, createdAt TEXT, status TEXT);';
  }
}
