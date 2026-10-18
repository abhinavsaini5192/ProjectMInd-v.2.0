import Database from 'better-sqlite3';
import { StorageMigrationManager } from './StorageMigrationManager.js';
import type { MigrationDefinition, MigrationPlan, MigrationRecord } from './MigrationTypes.js';
import { initializeJobDatabaseSchema } from '../../jobs/persistence/JobDatabaseSchema.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export interface MigrationRunnerOptions {
  readonly databasePath: string;
  readonly environment?: string | undefined;
  readonly logger?: ILogger | undefined;
  readonly lockTimeoutMs?: number | undefined;
}

export interface MigrationExecutionResult {
  readonly success: boolean;
  readonly currentVersion: number;
  readonly appliedCount: number;
  readonly appliedMigrations: readonly MigrationRecord[];
  readonly durationMs: number;
  readonly error?: string | undefined;
}

export interface MigrationStatusReport {
  readonly currentVersion: number;
  readonly latestAvailableVersion: number;
  readonly isUpToDate: boolean;
  readonly appliedHistory: readonly MigrationRecord[];
  readonly pendingMigrations: readonly { version: number; name: string }[];
}

/**
 * StorageMigrationRunner coordinates safe, isolated database schema initialization
 * and migration execution for standalone migration jobs, CLI, and container boot.
 */
export class StorageMigrationRunner {
  private readonly dbPath: string;
  private readonly environment: string;
  private readonly logger?: ILogger | undefined;
  private readonly lockTimeoutMs: number;

  constructor(options: MigrationRunnerOptions) {
    this.dbPath = options.databasePath;
    this.environment = options.environment ?? 'development';
    this.logger = options.logger;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 30000;
  }

  private openDatabase(): Database.Database {
    const db = new Database(this.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    return db;
  }

  /**
   * Initializes migration tracking and advisory lock tables.
   */
  public ensureMigrationTables(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pm_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        status TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        environment TEXT NOT NULL,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS pm_schema_migrations_lock (
        lock_id INTEGER PRIMARY KEY CHECK (lock_id = 1),
        owner_id TEXT NOT NULL,
        acquired_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * Acquires a cooperative lock in SQLite to prevent concurrent migration jobs from clashing.
   */
  public acquireLock(db: Database.Database, ownerId: string): boolean {
    this.ensureMigrationTables(db);
    const now = Date.now();
    const expiresAt = now + this.lockTimeoutMs;

    try {
      // 1. Delete any expired locks
      db.prepare(`DELETE FROM pm_schema_migrations_lock WHERE lock_id = 1 AND expires_at < ?`).run(now);

      // 2. Insert or fail if lock held
      const stmt = db.prepare(`
        INSERT INTO pm_schema_migrations_lock (lock_id, owner_id, acquired_at, expires_at)
        VALUES (1, ?, ?, ?)
      `);
      stmt.run(ownerId, now, expiresAt);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Releases cooperative migration lock.
   */
  public releaseLock(db: Database.Database, ownerId: string): void {
    try {
      db.prepare(`DELETE FROM pm_schema_migrations_lock WHERE lock_id = 1 AND owner_id = ?`).run(ownerId);
    } catch {
      // Non-blocking cleanup
    }
  }

  /**
   * Builds the standard migration suite for ProjectMind.
   */
  public buildMigrationManager(): StorageMigrationManager {
    const manager = new StorageMigrationManager({
      environment: this.environment,
      logger: this.logger,
    });

    // Migration V1: Core workspace & project schemas
    manager.registerMigration({
      version: 1,
      name: 'core_workspace_schema_v1',
      checksum: 'c1_workspaces_202610',
      description: 'Initializes base workspace and project repository models',
      up: async () => {},
    });

    // Migration V2: Verification, Knowledge health and Features
    manager.registerMigration({
      version: 2,
      name: 'features_and_verification_v2',
      checksum: 'c2_features_202610',
      description: 'Initializes feature health, verification state, and analytics schemas',
      dependencies: [1],
      up: async () => {},
    });

    // Migration V3: Durable Jobs & Distributed Event Processing
    manager.registerMigration({
      version: 3,
      name: 'durable_jobs_and_events_v3',
      checksum: 'c3_durable_jobs_202610',
      description: 'Initializes persistent jobs, attempts, DLQ, outbox, inbox, and replay tables',
      dependencies: [1, 2],
      up: async (ctx) => {
        if (ctx.context?.['db']) {
          initializeJobDatabaseSchema(ctx.context['db'] as Database.Database);
        }
      },
    });

    return manager;
  }

  /**
   * Loads applied migration history from SQLite into memory.
   */
  private loadAppliedHistory(db: Database.Database): MigrationRecord[] {
    this.ensureMigrationTables(db);
    const rows = db.prepare(`SELECT * FROM pm_schema_migrations ORDER BY version ASC`).all() as Array<{
      version: number;
      name: string;
      checksum: string;
      status: string;
      applied_at: number;
      duration_ms: number;
      error_message: string | null;
    }>;

    return rows.map((r) => ({
      version: r.version,
      name: r.name,
      checksum: r.checksum,
      status: r.status as any,
      appliedAt: r.applied_at,
      executionDurationMs: r.duration_ms,
      errorMessage: r.error_message ?? undefined,
    }));
  }

  /**
   * Records newly applied migration in SQLite.
   */
  private recordMigration(db: Database.Database, record: MigrationRecord): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO pm_schema_migrations (
        version, name, checksum, status, applied_at, duration_ms, environment, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.version,
      record.name,
      record.checksum,
      record.status,
      record.appliedAt ?? Date.now(),
      record.executionDurationMs ?? 0,
      this.environment,
      record.errorMessage ?? null
    );
  }

  /**
   * Inspects current migration status.
   */
  public async getStatus(): Promise<MigrationStatusReport> {
    const db = this.openDatabase();
    try {
      const history = this.loadAppliedHistory(db);
      const manager = this.buildMigrationManager();
      const allRegistered = manager.getRegisteredMigrations();

      const appliedVersions = new Set(history.filter((h) => h.status === 'APPLIED').map((h) => h.version));
      const currentVersion = appliedVersions.size > 0 ? Math.max(...Array.from(appliedVersions)) : 0;
      const latestAvailableVersion = allRegistered.length > 0 ? Math.max(...allRegistered.map((m) => m.version)) : 0;

      const pendingMigrations = allRegistered
        .filter((m) => !appliedVersions.has(m.version))
        .map((m) => ({ version: m.version, name: m.name }));

      return {
        currentVersion,
        latestAvailableVersion,
        isUpToDate: pendingMigrations.length === 0,
        appliedHistory: history,
        pendingMigrations,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Creates a dry-run migration plan.
   */
  public async plan(targetVersion?: number): Promise<MigrationPlan> {
    const db = this.openDatabase();
    try {
      const history = this.loadAppliedHistory(db);
      const manager = this.buildMigrationManager();

      // Seed history in manager
      for (const h of history) {
        (manager as any).migrationHistory.set(h.version, h);
      }

      return await manager.createMigrationPlan(targetVersion);
    } finally {
      db.close();
    }
  }

  /**
   * Runs pending migrations forward with concurrency locking and transaction protection.
   */
  public async runMigrations(targetVersion?: number, allowDestructive: boolean = false): Promise<MigrationExecutionResult> {
    const startTime = Date.now();
    const db = this.openDatabase();
    const ownerId = `migration_${process.pid}_${Date.now()}`;

    // 1. Acquire Lock
    const locked = this.acquireLock(db, ownerId);
    if (!locked) {
      db.close();
      return {
        success: false,
        currentVersion: 0,
        appliedCount: 0,
        appliedMigrations: [],
        durationMs: Date.now() - startTime,
        error: 'Could not acquire schema migration lock. Another migration process is active.',
      };
    }

    try {
      // 2. Load History
      const history = this.loadAppliedHistory(db);
      const manager = this.buildMigrationManager();

      for (const h of history) {
        (manager as any).migrationHistory.set(h.version, h);
      }

      // 3. Plan
      const plan = await manager.createMigrationPlan(targetVersion);
      if (!plan.isValid) {
        return {
          success: false,
          currentVersion: plan.currentVersion,
          appliedCount: 0,
          appliedMigrations: [],
          durationMs: Date.now() - startTime,
          error: `Migration planning failed: ${plan.errors.join('; ')}`,
        };
      }

      const appliedList: MigrationRecord[] = [];

      // 4. Apply each migration in an atomic transaction
      for (const migration of plan.plannedMigrations) {
        const stepStart = Date.now();
        const tx = db.transaction(() => {
          // Pass db in context so migrations can execute DDL
          migration.up({
            version: migration.version,
            name: migration.name,
            environment: this.environment,
            context: { db },
          });
        });

        try {
          tx();
          const rec: MigrationRecord = {
            version: migration.version,
            name: migration.name,
            checksum: migration.checksum,
            status: 'APPLIED',
            appliedAt: Date.now(),
            executionDurationMs: Date.now() - stepStart,
          };
          this.recordMigration(db, rec);
          appliedList.push(rec);

          this.logger?.info?.({
            component: 'StorageMigrationRunner',
            operation: 'migrate',
            message: `Applied migration v${migration.version} '${migration.name}' successfully.`,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const failedRec: MigrationRecord = {
            version: migration.version,
            name: migration.name,
            checksum: migration.checksum,
            status: 'FAILED',
            appliedAt: Date.now(),
            executionDurationMs: Date.now() - stepStart,
            errorMessage: errMsg,
          };
          this.recordMigration(db, failedRec);

          return {
            success: false,
            currentVersion: plan.currentVersion + appliedList.length,
            appliedCount: appliedList.length,
            appliedMigrations: appliedList,
            durationMs: Date.now() - startTime,
            error: `Migration v${migration.version} failed: ${errMsg}`,
          };
        }
      }

      const latestHistory = this.loadAppliedHistory(db);
      const finalVersion = Math.max(0, ...latestHistory.filter((h) => h.status === 'APPLIED').map((h) => h.version));

      return {
        success: true,
        currentVersion: finalVersion,
        appliedCount: appliedList.length,
        appliedMigrations: appliedList,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.releaseLock(db, ownerId);
      db.close();
    }
  }
}
