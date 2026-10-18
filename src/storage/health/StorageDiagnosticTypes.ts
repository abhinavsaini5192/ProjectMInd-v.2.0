export type StorageHealthCategory =
  | 'CONNECTION'
  | 'MIGRATION'
  | 'TRANSACTION'
  | 'INTEGRITY'
  | 'BACKUP'
  | 'PERFORMANCE';

export type DiagnosticSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface StorageDiagnostic {
  readonly diagnosticId: string;
  readonly category: StorageHealthCategory;
  readonly severity: DiagnosticSeverity;
  readonly status: 'ACTIVE' | 'RESOLVED';
  readonly message: string;
  readonly entity?: string | undefined;
  readonly timestamp: number;
  readonly latencyMs?: number | undefined;
  readonly remediationHint?: string | undefined;
}

export interface StorageHealthEvaluation {
  readonly isAlive: boolean;
  readonly isReady: boolean;
  readonly hasIntegrity: boolean;
  readonly overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly latencyMs: number;
  readonly diagnostics: readonly StorageDiagnostic[];
  readonly checkedAt: number;
}

export interface IStorageHealthService {
  checkHealth(): Promise<StorageHealthEvaluation>;
  recordDiagnostic(
    category: StorageHealthCategory,
    severity: DiagnosticSeverity,
    message: string,
    remediationHint?: string,
    entity?: string
  ): StorageDiagnostic;
  getActiveDiagnostics(): readonly StorageDiagnostic[];
  resolveDiagnostic(diagnosticId: string): boolean;
}

export const IStorageHealthServiceToken = Symbol('IStorageHealthService');
