import type { WorkloadRequest, WorkloadLimits } from '../models/Workload.js';

export interface IWorkloadLimiter {
  readonly limits: WorkloadLimits;

  /**
   * Attempts to acquire a workload execution permit.
   * Enforces global concurrency and per-workspace fairness limits.
   * Returns a release callback or throws/returns false if backpressure rejected.
   */
  acquire(request: WorkloadRequest): Promise<() => void>;

  /**
   * Checks if workload can be accepted without blocking.
   */
  canAccept(request: WorkloadRequest): boolean;

  /**
   * Current active permits for a given workspace.
   */
  getWorkspaceInUse(workspaceId: string): number;

  /**
   * Total active permits across all workspaces.
   */
  getGlobalInUse(): number;

  /**
   * Current queue depth for deferred requests.
   */
  getQueueDepth(): number;
}
