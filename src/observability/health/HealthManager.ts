import type {
  AggregatedHealthReport,
  HealthCheckResponse,
  HealthResult,
  HealthStatus,
  IHealthCheck,
  IHealthManager,
} from './HealthTypes.js';
import { defaultLogSanitizer, LogSanitizer } from '../logging/LogSanitizer.js';

export interface HealthManagerOptions {
  readonly sanitizer?: LogSanitizer | undefined;
  readonly defaultTimeoutMs?: number | undefined;
}

export class HealthManager implements IHealthManager {
  private readonly checks = new Map<string, IHealthCheck>();
  private readonly startTimeMs = Date.now();
  private readonly sanitizer: LogSanitizer;
  private readonly defaultTimeoutMs: number;

  constructor(options: HealthManagerOptions = {}) {
    this.sanitizer = options.sanitizer ?? defaultLogSanitizer;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
  }

  public registerCheck(check: IHealthCheck): void {
    this.checks.set(check.name, check);
  }

  public getLiveness(): { status: 'alive'; uptimeMs: number; timestamp: string } {
    return {
      status: 'alive',
      uptimeMs: Math.max(0, Date.now() - this.startTimeMs),
      timestamp: new Date().toISOString(),
    };
  }

  public async getReadiness(): Promise<{
    ready: boolean;
    timestamp: string;
    dependencies: Record<string, boolean>;
  }> {
    const report = await this.getHealth();
    const dependencies: Record<string, boolean> = {};

    for (const [name, comp] of Object.entries(report.components)) {
      if (comp.category === 'DEPENDENCY' || comp.required) {
        dependencies[name] = comp.status === 'HEALTHY' || comp.status === 'DEGRADED';
      }
    }

    return {
      ready: report.readiness.ready,
      timestamp: report.timestamp,
      dependencies,
    };
  }

  public async getHealth(): Promise<AggregatedHealthReport> {
    const liveness = this.getLiveness();
    const components: Record<string, HealthResult> = {};
    const warnings: string[] = [];
    const failures: string[] = [];

    let hasCriticalFailure = false;
    let hasDegraded = false;

    for (const [name, check] of this.checks.entries()) {
      const checkStart = Date.now();
      try {
        const timeoutPromise = new Promise<HealthCheckResponse>((_, reject) =>
          setTimeout(() => reject(new Error(`Check timed out after ${this.defaultTimeoutMs}ms`)), this.defaultTimeoutMs)
        );

        const checkPromise = check.check();
        const response = await Promise.race([checkPromise, timeoutPromise]);
        const durationMs = Date.now() - checkStart;

        const sanitizedDetails = response.details
          ? (this.sanitizer.sanitize(response.details) as Record<string, unknown>)
          : undefined;

        const result: HealthResult = {
          name,
          status: response.status,
          category: check.category,
          required: check.required,
          timestamp: new Date().toISOString(),
          durationMs,
          message: response.message ? this.sanitizer.sanitizeString(response.message) : undefined,
          details: sanitizedDetails,
        };

        components[name] = result;

        if (response.status === 'UNHEALTHY') {
          if (check.required) {
            hasCriticalFailure = true;
            failures.push(`Critical component '${name}' is UNHEALTHY: ${response.message ?? 'Unknown failure'}`);
          } else {
            hasDegraded = true;
            warnings.push(`Optional component '${name}' is UNHEALTHY: ${response.message ?? 'Unknown failure'}`);
          }
        } else if (response.status === 'DEGRADED') {
          hasDegraded = true;
          warnings.push(`Component '${name}' is DEGRADED: ${response.message ?? 'Suboptimal state'}`);
        }
      } catch (err: unknown) {
        const durationMs = Date.now() - checkStart;
        const errMsg = err instanceof Error ? err.message : String(err);
        const status: HealthStatus = check.required ? 'UNHEALTHY' : 'DEGRADED';

        components[name] = {
          name,
          status,
          category: check.category,
          required: check.required,
          timestamp: new Date().toISOString(),
          durationMs,
          message: this.sanitizer.sanitizeString(`Check execution error: ${errMsg}`),
        };

        if (check.required) {
          hasCriticalFailure = true;
          failures.push(`Critical component '${name}' check failed: ${errMsg}`);
        } else {
          hasDegraded = true;
          warnings.push(`Optional component '${name}' check failed: ${errMsg}`);
        }
      }
    }

    const overallStatus: HealthStatus = hasCriticalFailure
      ? 'UNHEALTHY'
      : hasDegraded
      ? 'DEGRADED'
      : 'HEALTHY';

    return {
      status: overallStatus,
      liveness: {
        alive: true,
        uptimeMs: liveness.uptimeMs,
      },
      readiness: {
        ready: !hasCriticalFailure,
        criticalDependenciesHealthy: !hasCriticalFailure,
      },
      components,
      warnings,
      failures,
      timestamp: new Date().toISOString(),
    };
  }
}

export const defaultHealthManager = new HealthManager();
