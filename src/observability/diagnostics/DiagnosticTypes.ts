export type DiagnosticCategory =
  | 'CONFIGURATION'
  | 'STORAGE'
  | 'MIGRATION'
  | 'SECURITY'
  | 'API'
  | 'CONTEXT'
  | 'KNOWLEDGE'
  | 'FEATURE'
  | 'AGENT'
  | 'VERIFICATION'
  | 'PERFORMANCE'
  | 'DEPENDENCY'
  | 'RUNTIME'
  | 'UNKNOWN';

export type DiagnosticSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type DiagnosticStatus = 'ACTIVE' | 'RESOLVED' | 'IGNORED';

export interface Diagnostic {
  readonly diagnosticId: string;
  readonly category: DiagnosticCategory;
  readonly component: string;
  readonly severity: DiagnosticSeverity;
  readonly status: DiagnosticStatus;
  readonly message: string;
  readonly detectedAt: string;
  readonly correlationId?: string | undefined;
  readonly remediationHint?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface DiagnosticSnapshot {
  readonly snapshotId: string;
  readonly generatedAt: string;
  readonly applicationVersion: string;
  readonly apiVersion: string;
  readonly environment: string;
  readonly runtimeState: {
    readonly nodeVersion: string;
    readonly platform: string;
    readonly uptimeSeconds: number;
    readonly memoryUsageMb: {
      readonly rss: number;
      readonly heapTotal: number;
      readonly heapUsed: number;
      readonly external: number;
    };
  };
  readonly activeDiagnostics: readonly Diagnostic[];
  readonly diagnosticCounts: {
    readonly total: number;
    readonly critical: number;
    readonly error: number;
    readonly warning: number;
    readonly info: number;
  };
  readonly telemetryState: {
    readonly loggingEnabled: boolean;
    readonly metricsEnabled: boolean;
    readonly tracingEnabled: boolean;
  };
}

export interface IDiagnosticManager {
  recordDiagnostic(params: Omit<Diagnostic, 'diagnosticId' | 'detectedAt' | 'status'> & { status?: DiagnosticStatus }): Diagnostic;
  resolveDiagnostic(diagnosticId: string): boolean;
  getActiveDiagnostics(category?: DiagnosticCategory): readonly Diagnostic[];
  createSnapshot(): Promise<DiagnosticSnapshot>;
  clear(): void;
}

export const IDiagnosticManagerToken = Symbol('IDiagnosticManager');
