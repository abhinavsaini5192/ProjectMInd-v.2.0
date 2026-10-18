import type { WorkloadRequest, WorkloadLimits, WorkloadPriority } from '../models/Workload.js';
import { DEFAULT_WORKLOAD_LIMITS } from '../models/Workload.js';
import type { IWorkloadLimiter } from './IWorkloadLimiter.js';

interface WorkloadWaiter {
  request: WorkloadRequest;
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  timer?: NodeJS.Timeout | undefined;
}

const PRIORITY_SCORES: Record<WorkloadPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export class WorkloadLimiter implements IWorkloadLimiter {
  private globalActive = 0;
  private readonly workspaceActive = new Map<string, number>();
  private readonly waiters: WorkloadWaiter[] = [];
  public readonly limits: WorkloadLimits;

  constructor(limits: Partial<WorkloadLimits> = {}) {
    this.limits = { ...DEFAULT_WORKLOAD_LIMITS, ...limits };
  }

  public getGlobalInUse(): number {
    return this.globalActive;
  }

  public getWorkspaceInUse(workspaceId: string): number {
    return this.workspaceActive.get(workspaceId) ?? 0;
  }

  public getQueueDepth(): number {
    return this.waiters.length;
  }

  public canAccept(request: WorkloadRequest): boolean {
    const wsActive = this.getWorkspaceInUse(request.workspaceId);
    return (
      this.globalActive < this.limits.maxGlobalConcurrency &&
      wsActive < this.limits.maxWorkspaceConcurrency
    );
  }

  public async acquire(request: WorkloadRequest): Promise<() => void> {
    const wsId = request.workspaceId;

    if (this.canAccept(request)) {
      return this.allocatePermit(wsId);
    }

    // Check backpressure queue depth
    if (this.waiters.length >= this.limits.maxQueueDepth) {
      throw new Error(
        `Workload rejected due to backpressure: queue depth limit (${this.limits.maxQueueDepth}) reached`
      );
    }

    return new Promise<() => void>((resolve, reject) => {
      const waiter: WorkloadWaiter = { request, resolve, reject };

      if (this.limits.queueTimeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx !== -1) {
            this.waiters.splice(idx, 1);
            reject(
              new Error(
                `Workload queue wait timed out after ${this.limits.queueTimeoutMs}ms for workspace '${wsId}'`
              )
            );
          }
        }, this.limits.queueTimeoutMs);
      }

      this.waiters.push(waiter);
      // Keep waiters sorted by priority descending
      this.waiters.sort((a, b) => {
        const pA = PRIORITY_SCORES[a.request.priority ?? 'NORMAL'];
        const pB = PRIORITY_SCORES[b.request.priority ?? 'NORMAL'];
        return pB - pA;
      });
    });
  }

  private allocatePermit(workspaceId: string): () => void {
    this.globalActive++;
    const currentWs = this.workspaceActive.get(workspaceId) ?? 0;
    this.workspaceActive.set(workspaceId, currentWs + 1);

    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.release(workspaceId);
      }
    };
  }

  private release(workspaceId: string): void {
    this.globalActive = Math.max(0, this.globalActive - 1);
    const currentWs = this.workspaceActive.get(workspaceId) ?? 0;
    if (currentWs <= 1) {
      this.workspaceActive.delete(workspaceId);
    } else {
      this.workspaceActive.set(workspaceId, currentWs - 1);
    }

    this.processNextWaiters();
  }

  private processNextWaiters(): void {
    if (this.waiters.length === 0 || this.globalActive >= this.limits.maxGlobalConcurrency) {
      return;
    }

    // Find the highest priority waiter whose workspace is not saturated
    for (let i = 0; i < this.waiters.length; i++) {
      const waiter = this.waiters[i]!;
      const wsActive = this.getWorkspaceInUse(waiter.request.workspaceId);

      if (wsActive < this.limits.maxWorkspaceConcurrency) {
        this.waiters.splice(i, 1);
        if (waiter.timer) {
          clearTimeout(waiter.timer);
        }

        const releaseFn = this.allocatePermit(waiter.request.workspaceId);
        waiter.resolve(releaseFn);
        break;
      }
    }
  }
}
