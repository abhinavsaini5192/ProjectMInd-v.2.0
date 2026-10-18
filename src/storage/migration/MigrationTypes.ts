export type MigrationStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'APPLIED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'BLOCKED'
  | 'UNKNOWN';

export interface MigrationExecutionContext {
  readonly version: number;
  readonly name: string;
  readonly environment: string;
  executeSql?: (sql: string, params?: readonly unknown[]) => Promise<unknown>;
  context?: Record<string, unknown> | undefined;
}

export interface MigrationDefinition {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly description?: string | undefined;
  readonly dependencies?: readonly number[] | undefined;
  readonly isDestructive?: boolean | undefined;
  readonly up: (context: MigrationExecutionContext) => Promise<void>;
  readonly down?: (context: MigrationExecutionContext) => Promise<void>;
}

export interface MigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly status: MigrationStatus;
  readonly appliedAt?: number | undefined;
  readonly executionDurationMs?: number | undefined;
  readonly errorMessage?: string | undefined;
}

export interface MigrationPlan {
  readonly currentVersion: number;
  readonly targetVersion: number;
  readonly plannedMigrations: readonly MigrationDefinition[];
  readonly hasDestructiveOperations: boolean;
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

export interface MigrationCompatibilityResult {
  readonly isCompatible: boolean;
  readonly currentStorageVersion: number;
  readonly requiredAppVersion: number;
  readonly status: 'COMPATIBLE' | 'MIGRATION_REQUIRED' | 'STORAGE_AHEAD_OF_APP' | 'CORRUPTED';
  readonly message: string;
}

export interface IMigrationManager {
  registerMigration(migration: MigrationDefinition): void;
  getRegisteredMigrations(): readonly MigrationDefinition[];
  getCurrentVersion(): Promise<number>;
  getMigrationHistory(): Promise<readonly MigrationRecord[]>;
  createMigrationPlan(targetVersion?: number): Promise<MigrationPlan>;
  applyMigrations(targetVersion?: number, allowDestructive?: boolean): Promise<readonly MigrationRecord[]>;
  rollbackMigration(version: number): Promise<MigrationRecord>;
  validateStartupCompatibility(requiredVersion: number): Promise<MigrationCompatibilityResult>;
}

export const IMigrationManagerToken = Symbol('IMigrationManager');
