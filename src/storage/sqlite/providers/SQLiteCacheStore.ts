import { SQLiteProvider } from '../core/SQLiteProvider.js';
import { StorageProviderType } from '../../types/StorageTypes.js';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';
import * as fs from 'fs';

export class SQLiteCacheStore extends SQLiteProvider {
  constructor(dbPath: string, logger: ILogger) {
    super('sqlite-cache', StorageProviderType.Cache, dbPath, logger);
  }

  protected getInitialSchema(): string {
    return 'CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER);';
  }
}
