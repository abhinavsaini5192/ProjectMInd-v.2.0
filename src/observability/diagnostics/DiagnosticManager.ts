import { randomUUID } from 'node:crypto';
import type {
  Diagnostic,
  DiagnosticCategory,
  DiagnosticSnapshot,
  DiagnosticStatus,
  IDiagnosticManager,
} from './DiagnosticTypes.js';
import { CorrelationContext } from '../correlation/CorrelationContext.js';
import { defaultLogSanitizer, LogSanitizer } from '../logging/LogSanitizer.js';

export interface DiagnosticManagerOptions {
  readonly appVersion?: string | undefined;
  readonly apiVersion?: string | undefined;
  readonly environment?: string | undefined;
  readonly maxDiagnostics?: number | undefined;
  readonly sanitizer?: LogSanitizer | undefined;
}

export class DiagnosticManager implements IDiagnosticManager {
  private readonly diagnostics = new Map<string, Diagnostic>();
  private readonly appVersion: string;
  private readonly apiVersion: string;
  private readonly environment: string;
  private readonly maxDiagnostics: number;
  private readonly sanitizer: LogSanitizer;

  constructor(options: DiagnosticManagerOptions = {}) {
    this.appVersion = options.appVersion ?? '1.0.0';
    this.apiVersion = options.apiVersion ?? 'v1';
    this.environment = options.environment ?? 'production';
    this.maxDiagnostics = options.maxDiagnostics ?? 500;
    this.sanitizer = options.sanitizer ?? defaultLogSanitizer;
  }

  public recordDiagnostic(
    params: Omit<Diagnostic, 'diagnosticId' | 'detectedAt' | 'status'> & { status?: DiagnosticStatus }
  ): Diagnostic {
    const ambient = CorrelationContext.current();
    const diagnosticId = randomUUID();

    const sanitizedMetadata = params.metadata
      ? (this.sanitizer.sanitize(params.metadata) as Record<string, unknown>)
      : undefined;

    const diag: Diagnostic = {
      diagnosticId,
      category: params.category,
      component: params.component,
      severity: params.severity,
      status: params.status ?? 'ACTIVE',
      message: this.sanitizer.sanitizeString(params.message),
      detectedAt: new Date().toISOString(),
      correlationId: params.correlationId ?? ambient?.correlationId,
      remediationHint: params.remediationHint
        ? this.sanitizer.sanitizeString(params.remediationHint)
        : undefined,
      metadata: sanitizedMetadata,
    };

    if (this.diagnostics.size >= this.maxDiagnostics) {
      // Remove oldest resolved or oldest item
      const firstKey = this.diagnostics.keys().next().value;
      if (firstKey) {
        this.diagnostics.delete(firstKey);
      }
    }

    this.diagnostics.set(diagnosticId, diag);
    return diag;
  }

  public resolveDiagnostic(diagnosticId: string): boolean {
    const diag = this.diagnostics.get(diagnosticId);
    if (!diag) return false;

    this.diagnostics.set(diagnosticId, {
      ...diag,
      status: 'RESOLVED',
    });
    return true;
  }

  public getActiveDiagnostics(category?: DiagnosticCategory): readonly Diagnostic[] {
    const list: Diagnostic[] = [];
    for (const d of this.diagnostics.values()) {
      if (d.status === 'ACTIVE') {
        if (!category || d.category === category) {
          list.push(d);
        }
      }
    }
    return list;
  }

  public async createSnapshot(): Promise<DiagnosticSnapshot> {
    const mem = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    const activeList = this.getActiveDiagnostics();
    const counts = {
      total: activeList.length,
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
    };

    for (const d of activeList) {
      if (d.severity === 'CRITICAL') counts.critical += 1;
      else if (d.severity === 'ERROR') counts.error += 1;
      else if (d.severity === 'WARNING') counts.warning += 1;
      else counts.info += 1;
    }

    return {
      snapshotId: randomUUID(),
      generatedAt: new Date().toISOString(),
      applicationVersion: this.appVersion,
      apiVersion: this.apiVersion,
      environment: this.environment,
      runtimeState: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsageMb: {
          rss: toMb(mem.rss),
          heapTotal: toMb(mem.heapTotal),
          heapUsed: toMb(mem.heapUsed),
          external: toMb(mem.external),
        },
      },
      activeDiagnostics: activeList,
      diagnosticCounts: counts,
      telemetryState: {
        loggingEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
      },
    };
  }

  public clear(): void {
    this.diagnostics.clear();
  }
}

export const defaultDiagnosticManager = new DiagnosticManager();
