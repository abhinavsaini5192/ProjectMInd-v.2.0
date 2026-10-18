import { SQLiteConnectionManager } from './SQLiteConnectionManager.js';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';

export class SQLiteMigrationManager {
  constructor(
    private connectionManager: SQLiteConnectionManager,
    private logger: ILogger
  ) {}

  ensureMigrationTable(): void {
    const db = this.connectionManager.getConnection();
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  getCurrentVersion(): number {
    const db = this.connectionManager.getConnection();
    this.ensureMigrationTable();
    
    const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as any;
    return row.version || 0;
  }

  applyMigration(version: number, name: string, sql: string, checksum: string): void {
    const db = this.connectionManager.getConnection();
    
    db.transaction(() => {
      db.exec(sql);
      const stmt = db.prepare('INSERT INTO _migrations (version, name, checksum) VALUES (?, ?, ?)');
      stmt.run(version, name, checksum);
    })();
    
    this.logger.info({
      component: 'SQLiteMigrationManager',
      operation: 'applyMigration',
      message: `Applied migration v${version}: ${name}`,
    });
  }
}
