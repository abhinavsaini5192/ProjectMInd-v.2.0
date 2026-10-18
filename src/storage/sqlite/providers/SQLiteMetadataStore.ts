import { SQLiteProvider } from '../core/SQLiteProvider.js';
import { StorageProviderType } from '../../types/StorageTypes.js';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';

export class SQLiteMetadataStore extends SQLiteProvider {
  constructor(dbPath: string, logger: ILogger) {
    super('sqlite-metadata', StorageProviderType.Metadata, dbPath, logger);
  }

  protected getInitialSchema(): string {
    return 'CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);';
  }
}
