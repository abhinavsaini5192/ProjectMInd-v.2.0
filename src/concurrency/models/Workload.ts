export type WorkloadPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface WorkloadRequest {
  readonly workloadId: string;
  readonly workspaceId: string;
  readonly operation: string;
  readonly priority?: WorkloadPriority | undefined;
  readonly weight?: number | undefined;
  readonly queuedAt?: number | undefined;
  readonly correlationId?: string | undefined;
}

export interface WorkloadLimits {
  readonly maxGlobalConcurrency: number;
  readonly maxWorkspaceConcurrency: number;
  readonly maxQueueDepth: number;
  readonly queueTimeoutMs: number;
}

export const DEFAULT_WORKLOAD_LIMITS: WorkloadLimits = {
  maxGlobalConcurrency: 50,
  maxWorkspaceConcurrency: 10,
  maxQueueDepth: 1000,
  queueTimeoutMs: 30000,
};
