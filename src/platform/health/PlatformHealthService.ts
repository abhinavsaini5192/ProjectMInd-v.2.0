import type {
  ComponentHealth,
  ComponentHealthStatus,
  PlatformHealthReport,
  LivenessReport,
  ReadinessReport,
} from './PlatformHealthModels.js';
import { PlatformLivenessProvider } from './PlatformLivenessProvider.js';
import { PlatformReadinessProvider } from './PlatformReadinessProvider.js';
import type { EnvironmentName } from '../config/PlatformConfig.js';
import { ConfigRedactor } from '../config/ConfigRedactor.js';

export type ComponentHealthFn = () => Promise<{
  status: ComponentHealthStatus;
  message?: string | undefined;
  details?: Record<string, unknown> | undefined;
}>;

export interface RegisteredComponent {
  readonly name: string;
  readonly check: ComponentHealthFn;
  readonly required: boolean;
}

export class PlatformHealthService {
  private readonly components = new Map<string, RegisteredComponent>();
  private readonly livenessProvider: PlatformLivenessProvider;
  private readonly readinessProvider: PlatformReadinessProvider;

  constructor(
    private readonly version: string = '1.0.0',
    private readonly env: EnvironmentName = 'development',
    livenessProvider?: PlatformLivenessProvider | undefined,
    readinessProvider?: PlatformReadinessProvider | undefined
  ) {
    this.livenessProvider = livenessProvider ?? new PlatformLivenessProvider();
    this.readinessProvider = readinessProvider ?? new PlatformReadinessProvider();
  }

  public registerComponent(name: string, check: ComponentHealthFn, required: boolean = true): void {
    this.components.set(name, { name, check, required });
    // Also register in readiness provider if required
    this.readinessProvider.registerDependency(
      name,
      async () => {
        try {
          const res = await check();
          return res.status === 'HEALTHY' || res.status === 'DEGRADED';
        } catch {
          return false;
        }
      },
      required
    );
  }

  public getLiveness(): LivenessReport {
    return this.livenessProvider.getLiveness();
  }

  public async getReadiness(): Promise<ReadinessReport> {
    return this.readinessProvider.getReadiness();
  }

  public async getHealth(): Promise<PlatformHealthReport> {
    const liveness = this.getLiveness();
    const componentReports: Record<string, ComponentHealth> = {};
    const warnings: string[] = [];
    const failures: string[] = [];
    let overallStatus: ComponentHealthStatus = 'HEALTHY';

    for (const [name, comp] of this.components.entries()) {
      const startTime = Date.now();
      try {
        const result = await comp.check();
        const latencyMs = Date.now() - startTime;

        const sanitizedDetails = result.details
          ? (ConfigRedactor.redact(result.details) as Record<string, unknown>)
          : undefined;

        componentReports[name] = {
          name,
          status: result.status,
          required: comp.required,
          latencyMs,
          message: result.message,
          lastCheckedAt: new Date().toISOString(),
          details: sanitizedDetails,
        };

        if (result.status === 'UNHEALTHY') {
          if (comp.required) {
            failures.push(`Critical component '${name}' is UNHEALTHY${result.message ? `: ${result.message}` : ''}`);
            overallStatus = 'UNHEALTHY';
          } else {
            warnings.push(`Optional component '${name}' is UNHEALTHY${result.message ? `: ${result.message}` : ''}`);
            if (overallStatus === 'HEALTHY') {
              overallStatus = 'DEGRADED';
            }
          }
        } else if (result.status === 'DEGRADED') {
          warnings.push(`Component '${name}' is DEGRADED${result.message ? `: ${result.message}` : ''}`);
          if (overallStatus !== 'UNHEALTHY') {
            overallStatus = 'DEGRADED';
          }
        }
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        const status: ComponentHealthStatus = comp.required ? 'UNHEALTHY' : 'DEGRADED';

        componentReports[name] = {
          name,
          status,
          required: comp.required,
          latencyMs,
          message: `Health check failed: ${errMsg}`,
          lastCheckedAt: new Date().toISOString(),
        };

        if (comp.required) {
          failures.push(`Critical component '${name}' check failed: ${errMsg}`);
          overallStatus = 'UNHEALTHY';
        } else {
          warnings.push(`Optional component '${name}' check failed: ${errMsg}`);
          if (overallStatus === 'HEALTHY') {
            overallStatus = 'DEGRADED';
          }
        }
      }
    }

    return {
      status: overallStatus,
      version: this.version,
      environment: this.env,
      uptimeMs: liveness.uptimeMs,
      timestamp: new Date().toISOString(),
      components: componentReports,
      warnings,
      failures,
    };
  }
}
