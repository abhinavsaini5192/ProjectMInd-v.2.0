import Database from 'better-sqlite3';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';
import { StorageCoreError } from '../../types/StorageErrors.js';

export class SQLiteConnectionManager {
  private db: Database.Database | null = null;

  constructor(
    private databasePath: string,
    private logger: ILogger,
    private options: Database.Options = {}
  ) {}

  open(): void {
    if (this.db) return;

    try {
      this.db = new Database(this.databasePath, this.options);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');
      this.logger.info({
        component: 'SQLiteConnectionManager',
        operation: 'open',
        message: `Opened connection to ${this.databasePath}`,
      });
    } catch (error: any) {
      this.logger.error({
        component: 'SQLiteConnectionManager',
        operation: 'open',
        message: `Failed to open ${this.databasePath}`,
        details: { error: error.message },
      });
      throw new StorageCoreError(`Failed to open database: ${error.message}`);
    }
  }

  close(): void {
    if (!this.db) return;

    try {
      this.db.close();
      this.db = null;
      this.logger.info({
        component: 'SQLiteConnectionManager',
        operation: 'close',
        message: `Closed connection to ${this.databasePath}`,
      });
    } catch (error: any) {
      throw new StorageCoreError(`Failed to close database: ${error.message}`);
    }
  }

  getConnection(): Database.Database {
    if (!this.db) {
      throw new StorageCoreError('Database connection is not open.');
    }
    return this.db;
  }
}
