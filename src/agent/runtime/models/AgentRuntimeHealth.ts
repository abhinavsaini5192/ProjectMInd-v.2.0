export type RuntimeHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface SubsystemHealthRecord {
  readonly status: RuntimeHealthStatus;
  readonly message?: string | undefined;
  readonly latencyMs?: number | undefined;
  readonly lastCheckedAt: number;
}

export interface AgentRuntimeHealth {
  readonly status: RuntimeHealthStatus;
  readonly runtimeId: string;
  readonly subsystems: Record<string, SubsystemHealthRecord>;
  readonly checkedAt: number;
}
