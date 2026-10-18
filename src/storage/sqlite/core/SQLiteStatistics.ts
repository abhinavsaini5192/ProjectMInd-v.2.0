import { SQLiteConnectionManager } from './SQLiteConnectionManager.js';
import type { DatabaseStatistics } from '../models/DatabaseStatistics.js';
import * as fs from 'fs';

export class SQLiteStatistics {
  constructor(private connectionManager: SQLiteConnectionManager, private dbPath: string, private dbName: string) {}

  getStatistics(): DatabaseStatistics {
    const db = this.connectionManager.getConnection();
    const isMemory = this.dbPath === ':memory:';
    const stats: DatabaseStatistics = {
      databaseName: this.dbName,
      sizeBytes: isMemory ? 0 : fs.statSync(this.dbPath).size,
      tableCount: 0,
      indexCount: 0,
      pageCount: 0,
      pageSize: 0
    };

    const tables = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").get() as any;
    stats.tableCount = tables.count;

    const indexes = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='index'").get() as any;
    stats.indexCount = indexes.count;

    const pageCount = db.prepare('PRAGMA page_count').get() as any;
    stats.pageCount = pageCount.page_count;

    const pageSize = db.prepare('PRAGMA page_size').get() as any;
    stats.pageSize = pageSize.page_size;

    return stats;
  }
}
