import type { ICoordinationService } from './ICoordinationService.js';
import type { ILeaderElector } from './ILeaderElector.js';
import type { Lease } from '../models/Lease.js';

export interface LeaderElectorOptions {
  readonly ttlMs?: number | undefined;
  readonly heartbeatIntervalMs?: number | undefined;
}

export class LeaderElector implements ILeaderElector {
  private currentLease: Lease | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly ttlMs: number;
  private readonly heartbeatIntervalMs: number;

  constructor(
    public readonly scope: string,
    public readonly instanceId: string,
    private readonly coordination: ICoordinationService,
    options: LeaderElectorOptions = {}
  ) {
    this.ttlMs = options.ttlMs ?? 15000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? Math.floor(this.ttlMs / 2);
  }

  private get resourceId(): string {
    return `leader:${this.scope}`;
  }

  public async tryAcquireLeadership(): Promise<boolean> {
    const lease = await this.coordination.acquireLease(this.resourceId, this.instanceId, {
      ttlMs: this.ttlMs,
      scope: this.scope,
    });

    if (lease && lease.holderId === this.instanceId) {
      this.currentLease = lease;
      return true;
    }

    if (this.currentLease) {
      this.currentLease = null;
    }
    return false;
  }

  public async renewLeadership(): Promise<boolean> {
    if (!this.currentLease) return false;

    const renewed = await this.coordination.renewLease(
      this.currentLease.leaseId,
      this.instanceId,
      this.ttlMs
    );

    if (!renewed) {
      this.currentLease = null;
      return false;
    }
    return true;
  }

  public async stepDown(): Promise<void> {
    if (this.currentLease) {
      await this.coordination.releaseLease(this.currentLease.leaseId, this.instanceId);
      this.currentLease = null;
    }
  }

  public isLeader(): boolean {
    if (!this.currentLease) return false;
    return this.currentLease.expiresAt > Date.now();
  }

  public async getLeader(): Promise<string | null> {
    const lease = await this.coordination.getLease(this.resourceId);
    return lease?.holderId ?? null;
  }

  public start(): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      try {
        if (this.isLeader()) {
          await this.renewLeadership();
        } else {
          await this.tryAcquireLeadership();
        }
      } catch {
        // Heartbeat failure isolation
      }
    }, this.heartbeatIntervalMs);

    // Initial attempt
    this.tryAcquireLeadership().catch(() => {});
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.stepDown();
  }
}
