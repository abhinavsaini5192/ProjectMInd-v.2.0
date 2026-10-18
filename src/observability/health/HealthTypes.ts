export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export type HealthCategory = 'LIVENESS' | 'READINESS' | 'DEPENDENCY' | 'INTEGRITY' | 'DEGRADED';

export interface HealthResult {
  readonly name: string;
  readonly status: HealthStatus;
  readonly category: HealthCategory;
  readonly required: boolean;
  readonly timestamp: string;
  readonly durationMs: number;
  readonly message?: string | undefined;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
}

export interface HealthCheckResponse {
  readonly status: HealthStatus;
  readonly message?: string | undefined;
  readonly details?: Record<string, unknown> | undefined;
}

export interface IHealthCheck {
  readonly name: string;
  readonly category: HealthCategory;
  readonly required: boolean;
  check(): Promise<HealthCheckResponse>;
}

export interface AggregatedHealthReport {
  readonly status: HealthStatus;
  readonly liveness: {
    readonly alive: boolean;
    readonly uptimeMs: number;
  };
  readonly readiness: {
    readonly ready: boolean;
    readonly criticalDependenciesHealthy: boolean;
  };
  readonly components: Record<string, HealthResult>;
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
  readonly timestamp: string;
}

export interface IHealthManager {
  registerCheck(check: IHealthCheck): void;
  getLiveness(): { status: 'alive'; uptimeMs: number; timestamp: string };
  getReadiness(): Promise<{ ready: boolean; timestamp: string; dependencies: Record<string, boolean> }>;
  getHealth(): Promise<AggregatedHealthReport>;
}

export const IHealthManagerToken = Symbol('IHealthManager');
