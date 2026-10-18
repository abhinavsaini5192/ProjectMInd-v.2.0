export type ComponentHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN' | 'DISABLED';

export interface ComponentHealth {
  readonly name: string;
  readonly status: ComponentHealthStatus;
  readonly required: boolean;
  readonly latencyMs?: number | undefined;
  readonly message?: string | undefined;
  readonly lastCheckedAt: string;
  readonly details?: Record<string, unknown> | undefined;
}

export interface PlatformHealthReport {
  readonly status: ComponentHealthStatus;
  readonly version: string;
  readonly environment: string;
  readonly uptimeMs: number;
  readonly timestamp: string;
  readonly components: Record<string, ComponentHealth>;
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
}

export interface LivenessReport {
  readonly status: 'alive';
  readonly uptimeMs: number;
  readonly timestamp: string;
}

export interface ReadinessReport {
  readonly ready: boolean;
  readonly dependencies: Record<string, boolean>;
  readonly timestamp: string;
}
