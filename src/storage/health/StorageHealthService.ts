import type {
  DiagnosticSeverity,
  IStorageHealthService,
  StorageDiagnostic,
  StorageHealthCategory,
  StorageHealthEvaluation,
} from './StorageDiagnosticTypes.js';
import type { IStorageProvider } from '../interfaces/IStorageProvider.js';
import type { IMigrationManager } from '../migration/MigrationTypes.js';
import type { IStorageIntegrityValidator } from '../consistency/StorageIntegrityTypes.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export interface StorageHealthServiceOptions {
  readonly providers?: readonly IStorageProvider[] | undefined;
  readonly migrationManager?: IMigrationManager | undefined;
  readonly integrityValidator?: IStorageIntegrityValidator | undefined;
  readonly requiredSchemaVersion?: number | undefined;
  readonly logger?: ILogger | undefined;
}

export class StorageHealthService implements IStorageHealthService {
  private readonly diagnostics = new Map<string, StorageDiagnostic>();

  constructor(private readonly options: StorageHealthServiceOptions = {}) {}

  public recordDiagnostic(
    category: StorageHealthCategory,
    severity: DiagnosticSeverity,
    message: string,
    remediationHint?: string,
    entity?: string
  ): StorageDiagnostic {
    const diagnosticId = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const diag: StorageDiagnostic = {
      diagnosticId,
      category,
      severity,
      status: 'ACTIVE',
      message,
      entity,
      timestamp: Date.now(),
      remediationHint,
    };

    this.diagnostics.set(diagnosticId, diag);

    this.options.logger?.warn?.({
      component: 'StorageHealthService',
      operation: 'recordDiagnostic',
      message: `[${category}] ${severity}: ${message}`,
      details: { diagnosticId, remediationHint },
    });

    return diag;
  }

  public getActiveDiagnostics(): readonly StorageDiagnostic[] {
    return Array.from(this.diagnostics.values()).filter((d) => d.status === 'ACTIVE');
  }

  public resolveDiagnostic(diagnosticId: string): boolean {
    const diag = this.diagnostics.get(diagnosticId);
    if (!diag) return false;

    (diag as any).status = 'RESOLVED';
    return true;
  }

  public async checkHealth(): Promise<StorageHealthEvaluation> {
    const startTime = Date.now();
    let isAlive = true;
    let isReady = true;
    let hasIntegrity = true;

    // 1. Check Liveness of all registered providers
    if (this.options.providers) {
      for (const provider of this.options.providers) {
        try {
          const providerHealth = await provider.healthCheck();
          if (!providerHealth.isHealthy) {
            isAlive = false;
            this.recordDiagnostic(
              'CONNECTION',
              'ERROR',
              `Provider '${provider.name}' healthCheck returned unhealthy: ${providerHealth.message ?? 'Unknown issue'}`,
              'Check database connection parameters and network availability',
              provider.name
            );
          }
        } catch (err: any) {
          isAlive = false;
          this.recordDiagnostic(
            'CONNECTION',
            'CRITICAL',
            `Provider '${provider.name}' healthCheck threw error: ${err.message}`,
            'Verify storage process is running and permissions are correct',
            provider.name
          );
        }
      }
    }

    // 2. Check Readiness via Migration Compatibility
    if (this.options.migrationManager && this.options.requiredSchemaVersion !== undefined) {
      try {
        const compat = await this.options.migrationManager.validateStartupCompatibility(
          this.options.requiredSchemaVersion
        );
        if (!compat.isCompatible) {
          isReady = false;
          this.recordDiagnostic(
            'MIGRATION',
            compat.status === 'CORRUPTED' ? 'CRITICAL' : 'ERROR',
            compat.message,
            compat.status === 'MIGRATION_REQUIRED'
              ? 'Run database migrations: npm run storage:migrate'
              : 'Inspect database _migrations table for failed entries'
          );
        }
      } catch (err: any) {
        isReady = false;
        this.recordDiagnostic(
          'MIGRATION',
          'ERROR',
          `Failed to validate migration compatibility: ${err.message}`,
          'Check storage connection and migration history table'
        );
      }
    }

    // 3. Check Data Integrity
    if (this.options.integrityValidator) {
      try {
        const integrityReport = await this.options.integrityValidator.runIntegrityChecks();
        if (!integrityReport.isValid) {
          hasIntegrity = false;
          this.recordDiagnostic(
            'INTEGRITY',
            integrityReport.summary.critical > 0 ? 'CRITICAL' : 'ERROR',
            `Integrity check reported ${integrityReport.issues.length} issues (${integrityReport.summary.critical} critical)`,
            'Review integrity issue log and repair orphan or invalid records'
          );
        }
      } catch (err: any) {
        hasIntegrity = false;
        this.recordDiagnostic(
          'INTEGRITY',
          'WARNING',
          `Integrity validation execution failed: ${err.message}`,
          'Check validator rules configuration'
        );
      }
    }

    const durationMs = Date.now() - startTime;
    const activeDiagnostics = this.getActiveDiagnostics();

    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    if (!isAlive || activeDiagnostics.some((d) => d.severity === 'CRITICAL')) {
      overallStatus = 'UNHEALTHY';
    } else if (!isReady || !hasIntegrity || activeDiagnostics.some((d) => d.severity === 'ERROR')) {
      overallStatus = 'DEGRADED';
    }

    return {
      isAlive,
      isReady,
      hasIntegrity,
      overallStatus,
      latencyMs: durationMs,
      diagnostics: activeDiagnostics,
      checkedAt: startTime,
    };
  }
}
