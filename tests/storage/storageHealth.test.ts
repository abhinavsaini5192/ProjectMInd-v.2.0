import { describe, it, expect, vi } from 'vitest';
import { StorageHealthService } from '../../src/storage/health/StorageHealthService';
import { IStorageProvider } from '../../src/storage/interfaces/IStorageProvider';
import { IMigrationManager } from '../../src/storage/migration/MigrationTypes';
import { IStorageIntegrityValidator } from '../../src/storage/consistency/StorageIntegrityTypes';
import { StorageProviderType, ProviderState } from '../../src/storage/types/StorageTypes';

const createMockProvider = (isHealthy: boolean): IStorageProvider => ({
  name: 'mock_sqlite',
  type: StorageProviderType.Filesystem,
  state: ProviderState.Ready,
  initialize: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({
    isHealthy,
    message: isHealthy ? 'OK' : 'Connection failed',
  }),
  getStatistics: vi.fn(),
  backup: vi.fn(),
  restore: vi.fn(),
  migrate: vi.fn(),
});

describe('Phase 8.4 - Storage Health & Diagnostics', () => {
  it('should report unhealthy liveness and readiness when provider healthCheck fails', async () => {
    const provider = createMockProvider(false);
    const healthService = new StorageHealthService({
      providers: [provider],
    });

    const evalResult = await healthService.checkHealth();

    expect(evalResult.isAlive).toBe(false);
    expect(evalResult.overallStatus).toBe('UNHEALTHY');
    expect(evalResult.diagnostics).toHaveLength(1);
    expect(evalResult.diagnostics[0].category).toBe('CONNECTION');
  });

  it('should distinguish liveness from readiness when storage is live but schema is incompatible', async () => {
    const provider = createMockProvider(true);
    const mockMigrationManager: Partial<IMigrationManager> = {
      validateStartupCompatibility: vi.fn().mockResolvedValue({
        isCompatible: false,
        status: 'MIGRATION_REQUIRED',
        message: 'Schema behind app version',
        currentStorageVersion: 1,
        requiredAppVersion: 2,
      }),
    };

    const healthService = new StorageHealthService({
      providers: [provider],
      migrationManager: mockMigrationManager as IMigrationManager,
      requiredSchemaVersion: 2,
    });

    const evalResult = await healthService.checkHealth();

    expect(evalResult.isAlive).toBe(true);
    expect(evalResult.isReady).toBe(false); // Schema not ready
    expect(evalResult.overallStatus).toBe('DEGRADED');
    expect(evalResult.diagnostics[0].category).toBe('MIGRATION');
  });

  it('should distinguish readiness from data integrity when database is live and migrated but integrity issues exist', async () => {
    const provider = createMockProvider(true);
    const mockMigrationManager: Partial<IMigrationManager> = {
      validateStartupCompatibility: vi.fn().mockResolvedValue({
        isCompatible: true,
        status: 'COMPATIBLE',
        message: 'OK',
        currentStorageVersion: 1,
        requiredAppVersion: 1,
      }),
    };
    const mockIntegrityValidator: Partial<IStorageIntegrityValidator> = {
      runIntegrityChecks: vi.fn().mockResolvedValue({
        isValid: false,
        checkedAt: Date.now(),
        durationMs: 5,
        totalChecked: 1,
        issues: [
          {
            issueId: 'iss-1',
            entityType: 'Task',
            entityId: 't-1',
            issueType: 'ORPHAN_RECORD',
            severity: 'HIGH',
            description: 'Orphan task',
            detectedAt: Date.now(),
            repairable: false,
          },
        ],
        summary: { critical: 0, high: 1, medium: 0, low: 0 },
      }),
    };

    const healthService = new StorageHealthService({
      providers: [provider],
      migrationManager: mockMigrationManager as IMigrationManager,
      integrityValidator: mockIntegrityValidator as IStorageIntegrityValidator,
      requiredSchemaVersion: 1,
    });

    const evalResult = await healthService.checkHealth();

    expect(evalResult.isAlive).toBe(true);
    expect(evalResult.isReady).toBe(true);
    expect(evalResult.hasIntegrity).toBe(false);
    expect(evalResult.overallStatus).toBe('DEGRADED');
    expect(evalResult.diagnostics[0].category).toBe('INTEGRITY');
  });

  it('should record, list, and resolve diagnostics manually', () => {
    const healthService = new StorageHealthService();

    const diag = healthService.recordDiagnostic(
      'PERFORMANCE',
      'WARNING',
      'Disk volume at 85% capacity',
      'Purge expired archives or expand volume'
    );

    expect(diag.diagnosticId).toBeDefined();
    expect(healthService.getActiveDiagnostics()).toHaveLength(1);

    const resolved = healthService.resolveDiagnostic(diag.diagnosticId);
    expect(resolved).toBe(true);
    expect(healthService.getActiveDiagnostics()).toHaveLength(0);
  });
});
