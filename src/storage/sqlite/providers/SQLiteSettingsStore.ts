import { SQLiteProvider } from '../core/SQLiteProvider.js';
import { StorageProviderType } from '../../types/StorageTypes.js';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';

export class SQLiteSettingsStore extends SQLiteProvider {
  constructor(dbPath: string, logger: ILogger) {
    super('sqlite-settings', StorageProviderType.Settings, dbPath, logger);
  }

  protected getInitialSchema(): string {
    return 'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);';
  }
}
