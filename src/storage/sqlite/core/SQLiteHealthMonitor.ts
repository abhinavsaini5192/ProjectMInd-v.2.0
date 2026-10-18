import { SQLiteConnectionManager } from './SQLiteConnectionManager.js';
import type { DatabaseHealth } from '../models/DatabaseHealth.js';

export class SQLiteHealthMonitor {
  constructor(private connectionManager: SQLiteConnectionManager, private dbName: string) {}

  checkHealth(): DatabaseHealth {
    const db = this.connectionManager.getConnection();
    const errors: string[] = [];
    let integrityCheckPassed = false;
    let foreignKeyCheckPassed = false;

    try {
      const integrity = db.prepare('PRAGMA integrity_check').get() as any;
      integrityCheckPassed = integrity.integrity_check === 'ok';
      if (!integrityCheckPassed) errors.push('Integrity check failed');
    } catch (e: any) {
      errors.push(`Integrity check error: ${e.message}`);
    }

    try {
      const fks = db.prepare('PRAGMA foreign_key_check').all();
      foreignKeyCheckPassed = fks.length === 0;
      if (!foreignKeyCheckPassed) errors.push('Foreign key constraint violations detected');
    } catch (e: any) {
      errors.push(`Foreign key check error: ${e.message}`);
    }

    return {
      databaseName: this.dbName,
      isHealthy: integrityCheckPassed && foreignKeyCheckPassed,
      integrityCheckPassed,
      foreignKeyCheckPassed,
      currentVersion: 0, // Should be fetched from migration manager in full impl
      errors
    };
  }
}
