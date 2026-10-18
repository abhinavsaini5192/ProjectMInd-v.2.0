import { SQLiteProvider } from '../core/SQLiteProvider.js';
import { StorageProviderType } from '../../types/StorageTypes.js';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';

export class SQLiteMemoryStore extends SQLiteProvider {
  constructor(dbPath: string, logger: ILogger) {
    super('sqlite-memory', StorageProviderType.Memory, dbPath, logger);
  }

  protected getInitialSchema(): string {
    return 'CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT, content TEXT, timestamp INTEGER);';
  }
}
