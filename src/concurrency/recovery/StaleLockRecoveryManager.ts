import type { IResourceLockManager } from '../locking/IResourceLockManager.js';
import type { ICoordinationService } from '../coordination/ICoordinationService.js';
import type { ConcurrencyTelemetry } from '../observability/ConcurrencyTelemetry.js';

export interface RecoveryOptions {
  readonly intervalMs?: number | undefined;
}

export class StaleLockRecoveryManager {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;

  constructor(
    private readonly lockManager: IResourceLockManager,
    private readonly coordination?: ICoordinationService | undefined,
    private readonly telemetry?: ConcurrencyTelemetry | undefined,
    options: RecoveryOptions = {}
  ) {
    this.intervalMs = options.intervalMs ?? 15000;
  }

  /**
   * Performs an immediate sweep of all expired locks and leases.
   */
  public async sweep(): Promise<{ purgedLocks: string[] }> {
    const purgedLocks = await this.lockManager.purgeExpired();

    if (purgedLocks.length > 0 && this.telemetry) {
      for (const key of purgedLocks) {
        this.telemetry.recordLockExpired(key);
      }
    }

    return { purgedLocks };
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.sweep().catch(() => {});
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
