import type {
  IMigrationManager,
  MigrationCompatibilityResult,
  MigrationDefinition,
  MigrationExecutionContext,
  MigrationPlan,
  MigrationRecord,
} from './MigrationTypes.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';
import type { ITransactionManager } from '../consistency/TransactionTypes.js';

export interface StorageMigrationManagerOptions {
  readonly environment?: string | undefined;
  readonly transactionManager?: ITransactionManager | undefined;
  readonly logger?: ILogger | undefined;
  readonly initialHistory?: readonly MigrationRecord[] | undefined;
}

export class StorageMigrationManager implements IMigrationManager {
  private readonly registeredMigrations = new Map<number, MigrationDefinition>();
  private readonly migrationHistory = new Map<number, MigrationRecord>();
  private readonly environment: string;

  constructor(private readonly options: StorageMigrationManagerOptions = {}) {
    this.environment = options.environment ?? 'development';
    if (options.initialHistory) {
      for (const record of options.initialHistory) {
        this.migrationHistory.set(record.version, record);
      }
    }
  }

  public registerMigration(migration: MigrationDefinition): void {
    if (this.registeredMigrations.has(migration.version)) {
      throw new StorageCoreError(
        `Duplicate migration version: ${migration.version} is already registered as '${this.registeredMigrations.get(migration.version)?.name}'`
      );
    }
    this.registeredMigrations.set(migration.version, migration);
  }

  public getRegisteredMigrations(): readonly MigrationDefinition[] {
    return Array.from(this.registeredMigrations.values()).sort((a, b) => a.version - b.version);
  }

  public async getCurrentVersion(): Promise<number> {
    const applied = Array.from(this.migrationHistory.values())
      .filter((m) => m.status === 'APPLIED')
      .map((m) => m.version);
    return applied.length > 0 ? Math.max(...applied) : 0;
  }

  public async getMigrationHistory(): Promise<readonly MigrationRecord[]> {
    return Array.from(this.migrationHistory.values()).sort((a, b) => a.version - b.version);
  }

  public async createMigrationPlan(targetVersion?: number): Promise<MigrationPlan> {
    const currentVersion = await this.getCurrentVersion();
    const allRegistered = this.getRegisteredMigrations();
    const effectiveTarget = targetVersion ?? (allRegistered.length > 0 ? allRegistered[allRegistered.length - 1]!.version : 0);

    const errors: string[] = [];
    const plannedMigrations: MigrationDefinition[] = [];

    // Verify previously applied migrations have not had their checksum altered
    for (const applied of this.migrationHistory.values()) {
      if (applied.status === 'APPLIED') {
        const registered = this.registeredMigrations.get(applied.version);
        if (!registered) {
          errors.push(`Applied migration v${applied.version} ('${applied.name}') is missing from registered migrations`);
        } else if (registered.checksum !== applied.checksum) {
          errors.push(
            `Checksum mismatch on applied migration v${applied.version}: stored '${applied.checksum}', but registered code is '${registered.checksum}'`
          );
        }
      }
    }

    let hasDestructive = false;

    for (const m of allRegistered) {
      if (m.version > currentVersion && m.version <= effectiveTarget) {
        // Verify dependencies
        if (m.dependencies) {
          for (const dep of m.dependencies) {
            const isApplied = this.migrationHistory.get(dep)?.status === 'APPLIED';
            const isPlanned = plannedMigrations.some((p) => p.version === dep);
            if (!isApplied && !isPlanned) {
              errors.push(
                `Migration v${m.version} ('${m.name}') requires prerequisite v${dep} which is not applied or planned`
              );
            }
          }
        }

        if (m.isDestructive) {
          hasDestructive = true;
        }

        plannedMigrations.push(m);
      }
    }

    return {
      currentVersion,
      targetVersion: effectiveTarget,
      plannedMigrations,
      hasDestructiveOperations: hasDestructive,
      isValid: errors.length === 0,
      errors,
    };
  }

  public async applyMigrations(
    targetVersion?: number,
    allowDestructive: boolean = false
  ): Promise<readonly MigrationRecord[]> {
    const plan = await this.createMigrationPlan(targetVersion);

    if (!plan.isValid) {
      throw new StorageCoreError(
        `Cannot apply migrations due to validation errors:\n- ${plan.errors.join('\n- ')}`
      );
    }

    if (plan.hasDestructiveOperations && !allowDestructive && this.environment === 'production') {
      throw new StorageCoreError(
        `Destructive migrations detected in plan, but 'allowDestructive' is false in production environment. Aborting for safety.`
      );
    }

    const appliedRecords: MigrationRecord[] = [];

    for (const migration of plan.plannedMigrations) {
      const startTime = Date.now();
      const executionContext: MigrationExecutionContext = {
        version: migration.version,
        name: migration.name,
        environment: this.environment,
      };

      // Set state to RUNNING
      this.migrationHistory.set(migration.version, {
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        status: 'RUNNING',
      });

      this.options.logger?.info?.({
        component: 'StorageMigrationManager',
        operation: 'applyMigration',
        message: `Applying migration v${migration.version}: ${migration.name}`,
      });

      try {
        if (this.options.transactionManager) {
          await this.options.transactionManager.runInTransaction(async () => {
            await migration.up(executionContext);
          }, { name: `migration_v${migration.version}` });
        } else {
          await migration.up(executionContext);
        }

        const durationMs = Date.now() - startTime;
        const record: MigrationRecord = {
          version: migration.version,
          name: migration.name,
          checksum: migration.checksum,
          status: 'APPLIED',
          appliedAt: Date.now(),
          executionDurationMs: durationMs,
        };

        this.migrationHistory.set(migration.version, record);
        appliedRecords.push(record);

        this.options.logger?.info?.({
          component: 'StorageMigrationManager',
          operation: 'applyMigration',
          message: `Successfully applied migration v${migration.version}: ${migration.name} in ${durationMs}ms`,
        });
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        const failedRecord: MigrationRecord = {
          version: migration.version,
          name: migration.name,
          checksum: migration.checksum,
          status: 'FAILED',
          executionDurationMs: durationMs,
          errorMessage: err.message,
        };

        this.migrationHistory.set(migration.version, failedRecord);

        this.options.logger?.error?.({
          component: 'StorageMigrationManager',
          operation: 'applyMigration',
          message: `Failed to apply migration v${migration.version}: ${err.message}`,
          details: { error: err.message },
        });

        throw new StorageCoreError(
          `Migration v${migration.version} ('${migration.name}') failed: ${err.message}`,
          err
        );
      }
    }

    return appliedRecords;
  }

  public async rollbackMigration(version: number): Promise<MigrationRecord> {
    const record = this.migrationHistory.get(version);
    if (!record || record.status !== 'APPLIED') {
      throw new StorageCoreError(`Migration v${version} is not currently in APPLIED status`);
    }

    const migration = this.registeredMigrations.get(version);
    if (!migration) {
      throw new StorageCoreError(`Cannot rollback v${version}: migration definition not found`);
    }
    if (!migration.down) {
      throw new StorageCoreError(`Cannot rollback v${version}: migration does not define a down() action`);
    }

    const startTime = Date.now();
    const executionContext: MigrationExecutionContext = {
      version: migration.version,
      name: migration.name,
      environment: this.environment,
    };

    try {
      if (this.options.transactionManager) {
        await this.options.transactionManager.runInTransaction(async () => {
          await migration.down!(executionContext);
        }, { name: `rollback_v${migration.version}` });
      } else {
        await migration.down(executionContext);
      }

      const rolledBackRecord: MigrationRecord = {
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        status: 'ROLLED_BACK',
        appliedAt: Date.now(),
        executionDurationMs: Date.now() - startTime,
      };

      this.migrationHistory.set(version, rolledBackRecord);
      return rolledBackRecord;
    } catch (err: any) {
      throw new StorageCoreError(`Rollback of migration v${version} failed: ${err.message}`, err);
    }
  }

  public async validateStartupCompatibility(
    requiredVersion: number
  ): Promise<MigrationCompatibilityResult> {
    const currentVersion = await this.getCurrentVersion();

    // Check if any migration is in FAILED status
    const failedMigration = Array.from(this.migrationHistory.values()).find((m) => m.status === 'FAILED');
    if (failedMigration) {
      return {
        isCompatible: false,
        currentStorageVersion: currentVersion,
        requiredAppVersion: requiredVersion,
        status: 'CORRUPTED',
        message: `Storage has a recorded FAILED migration v${failedMigration.version} ('${failedMigration.name}'). Manual operator remediation required.`,
      };
    }

    if (currentVersion < requiredVersion) {
      return {
        isCompatible: false,
        currentStorageVersion: currentVersion,
        requiredAppVersion: requiredVersion,
        status: 'MIGRATION_REQUIRED',
        message: `Storage schema version (${currentVersion}) is behind application requirements (${requiredVersion}). Run pending migrations.`,
      };
    }

    if (currentVersion > requiredVersion) {
      return {
        isCompatible: false,
        currentStorageVersion: currentVersion,
        requiredAppVersion: requiredVersion,
        status: 'STORAGE_AHEAD_OF_APP',
        message: `Storage schema version (${currentVersion}) is ahead of application version (${requiredVersion}). Application upgrade or schema alignment required.`,
      };
    }

    return {
      isCompatible: true,
      currentStorageVersion: currentVersion,
      requiredAppVersion: requiredVersion,
      status: 'COMPATIBLE',
      message: `Storage schema is fully compatible with application version ${requiredVersion}.`,
    };
  }
}
