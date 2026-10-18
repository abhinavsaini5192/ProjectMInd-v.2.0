import { describe, it, expect } from 'vitest';
import { StorageMigrationManager } from '../../src/storage/migration/StorageMigrationManager';
import { MigrationDefinition } from '../../src/storage/migration/MigrationTypes';
import { StorageCoreError } from '../../src/storage/types/StorageErrors';

describe('Phase 8.4 - Schema Migration Lifecycle', () => {
  it('should plan and apply migrations in strictly sorted order', async () => {
    const manager = new StorageMigrationManager();

    const m2: MigrationDefinition = {
      version: 2,
      name: 'add_feature_index',
      description: 'Add index on features table',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b852',
      up: async () => {},
      down: async () => {},
    };

    const m1: MigrationDefinition = {
      version: 1,
      name: 'initial_schema',
      description: 'Create initial core tables',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b851',
      up: async () => {},
      down: async () => {},
    };

    manager.registerMigration(m2);
    manager.registerMigration(m1);

    const plan = await manager.createMigrationPlan(2);
    expect(plan.plannedMigrations.map((m) => m.version)).toEqual([1, 2]);

    const applied = await manager.applyMigrations(2);
    expect(applied).toHaveLength(2);
    expect(applied[0].version).toBe(1);
    expect(applied[0].status).toBe('APPLIED');
    expect(applied[1].version).toBe(2);
    expect(applied[1].status).toBe('APPLIED');

    const currentVersion = await manager.getCurrentVersion();
    expect(currentVersion).toBe(2);
  });

  it('should avoid re-applying already applied migrations', async () => {
    const manager = new StorageMigrationManager();

    manager.registerMigration({
      version: 1,
      name: 'init',
      description: 'init',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b851',
      up: async () => {},
    });

    await manager.applyMigrations(1);
    const appliedSecondTime = await manager.applyMigrations(1);

    expect(appliedSecondTime).toHaveLength(0);
  });

  it('should detect checksum tampering on previously applied migrations', async () => {
    const manager = new StorageMigrationManager();

    manager.registerMigration({
      version: 1,
      name: 'init',
      description: 'init',
      checksum: 'valid_checksum_123',
      up: async () => {},
    });

    await manager.applyMigrations(1);

    // Re-use history with original checksum
    const history = await manager.getMigrationHistory();

    // Register a second migration with mismatched checksum for 1
    const tamperedManager = new StorageMigrationManager({ initialHistory: history });
    tamperedManager.registerMigration({
      version: 1,
      name: 'init',
      description: 'init',
      checksum: 'tampered_checksum_999',
      up: async () => {},
    });

    await expect(tamperedManager.applyMigrations()).rejects.toThrow(StorageCoreError);
  });

  it('should detect failed migrations and mark them as FAILED', async () => {
    const manager = new StorageMigrationManager();

    manager.registerMigration({
      version: 1,
      name: 'failing_migration',
      description: 'causes error',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b850',
      up: async () => {
        throw new Error('SQL syntax error in migration');
      },
    });

    await expect(manager.applyMigrations(1)).rejects.toThrow(
      'SQL syntax error in migration'
    );

    const history = await manager.getMigrationHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('FAILED');
    expect(history[0].errorMessage).toBe('SQL syntax error in migration');
  });

  it('should perform safe startup compatibility checks', async () => {
    const manager = new StorageMigrationManager();

    manager.registerMigration({
      version: 1,
      name: 'v1',
      description: 'v1 schema',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b851',
      up: async () => {},
    });

    // When nothing is applied
    let check = await manager.validateStartupCompatibility(1);
    expect(check.isCompatible).toBe(false);
    expect(check.status).toBe('MIGRATION_REQUIRED');

    // After applying migration
    await manager.applyMigrations(1);
    check = await manager.validateStartupCompatibility(1);
    expect(check.isCompatible).toBe(true);
    expect(check.status).toBe('COMPATIBLE');

    // Incompatible app version (app version ahead of storage)
    check = await manager.validateStartupCompatibility(2);
    expect(check.isCompatible).toBe(false);
    expect(check.status).toBe('MIGRATION_REQUIRED');
  });

  it('should support migration rollback when down action is provided', async () => {
    const manager = new StorageMigrationManager();
    let downCalled = false;

    manager.registerMigration({
      version: 1,
      name: 'reversible_migration',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b851',
      up: async () => {},
      down: async () => {
        downCalled = true;
      },
    });

    await manager.applyMigrations(1);
    expect(await manager.getCurrentVersion()).toBe(1);

    const rolledBack = await manager.rollbackMigration(1);
    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(downCalled).toBe(true);
    expect(await manager.getCurrentVersion()).toBe(0);
  });
});
