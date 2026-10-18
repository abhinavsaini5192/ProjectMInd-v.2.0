import type { IStorageProvider } from '../../interfaces/IStorageProvider.js';
import { StorageProviderType, ProviderState } from '../../types/StorageTypes.js';
import type { StorageConfiguration } from '../../models/StorageConfiguration.js';
import type { StorageHealth } from '../../models/StorageHealth.js';
import type { StorageStatistics } from '../../models/StorageStatistics.js';
import type { ILogger } from '../../../workspace/interfaces/ILogger.js';

import { SQLiteConnectionManager } from './SQLiteConnectionManager.js';
import { SQLiteHealthMonitor } from './SQLiteHealthMonitor.js';
import { SQLiteStatistics } from './SQLiteStatistics.js';
import { SQLiteBackupManager } from './SQLiteBackupManager.js';
import { SQLiteSchemaManager } from './SQLiteSchemaManager.js';
import { SQLiteMigrationManager } from './SQLiteMigrationManager.js';
import { SQLiteTransactionManager } from './SQLiteTransactionManager.js';
import { SQLiteQueryBuilder } from './SQLiteQueryBuilder.js';

export abstract class SQLiteProvider implements IStorageProvider {
  public state: ProviderState = ProviderState.Unregistered;
  
  protected connectionManager!: SQLiteConnectionManager;
  protected healthMonitor!: SQLiteHealthMonitor;
  protected statistics!: SQLiteStatistics;
  protected backupManager!: SQLiteBackupManager;
  protected schemaManager!: SQLiteSchemaManager;
  protected migrationManager!: SQLiteMigrationManager;
  protected transactionManager!: SQLiteTransactionManager;
  protected queryBuilder!: SQLiteQueryBuilder;

  constructor(
    public readonly name: string,
    public readonly type: StorageProviderType,
    protected dbPath: string,
    protected logger: ILogger
  ) {}

  protected abstract getInitialSchema(): string;

  async initialize(config: StorageConfiguration): Promise<void> {
    this.state = ProviderState.Initializing;
    
    this.connectionManager = new SQLiteConnectionManager(this.dbPath, this.logger, config.options);
    this.healthMonitor = new SQLiteHealthMonitor(this.connectionManager, this.name);
    this.statistics = new SQLiteStatistics(this.connectionManager, this.dbPath, this.name);
    this.backupManager = new SQLiteBackupManager(this.connectionManager, this.dbPath);
    this.migrationManager = new SQLiteMigrationManager(this.connectionManager, this.logger);
    this.schemaManager = new SQLiteSchemaManager(this.connectionManager, this.migrationManager);
    this.transactionManager = new SQLiteTransactionManager(this.connectionManager);
    this.queryBuilder = new SQLiteQueryBuilder(this.connectionManager);

    this.connectionManager.open();
    await this.schemaManager.initializeSchema(this.getInitialSchema());
    
    this.state = ProviderState.Ready;
  }

  async start(): Promise<void> {
    if (this.state !== ProviderState.Ready) {
      throw new Error(`Cannot start provider ${this.name} from state ${this.state}`);
    }
  }

  async stop(): Promise<void> {
    this.connectionManager.close();
    this.state = ProviderState.Stopped;
  }

  async dispose(): Promise<void> {
    await this.stop();
  }

  async healthCheck(): Promise<StorageHealth> {
    const dbHealth = this.healthMonitor.checkHealth();
    return {
      providerName: this.name,
      isHealthy: dbHealth.isHealthy,
      databaseName: dbHealth.databaseName,
      integrityCheckPassed: dbHealth.integrityCheckPassed,
      foreignKeyCheckPassed: dbHealth.foreignKeyCheckPassed,
      currentVersion: dbHealth.currentVersion,
      lastCheckTimestamp: new Date().toISOString(),
      errors: dbHealth.errors,
    };
  }

  async getStatistics(): Promise<StorageStatistics> {
    const dbStats = this.statistics.getStatistics();
    return {
      providerName: this.name,
      databaseName: dbStats.databaseName,
      totalReads: 0,
      totalWrites: 0,
      tableCount: dbStats.tableCount,
      indexCount: dbStats.indexCount,
      pageCount: dbStats.pageCount,
      pageSize: dbStats.pageSize,
      averageLatencyMs: 0,
      uptimeMs: 0,
      activeConnections: 1,
      errorCount: 0,
    };
  }

  async backup(destinationPath: string): Promise<void> {
    await this.backupManager.backup(destinationPath);
  }

  async restore(sourcePath: string): Promise<void> {
    throw new Error('SQLite restore must be done via filesys overwrite while stopped.');
  }

  async migrate(targetVersion: string): Promise<void> {
    // Advanced migration logic handled by migration manager
  }
}
