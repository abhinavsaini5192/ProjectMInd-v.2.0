import type { IWorkerPool } from '../../jobs/workers/IWorkerPool.js';
import type { IScheduler } from '../../jobs/scheduling/IScheduler.js';
import type { ILeaderElector } from '../../concurrency/coordination/ILeaderElector.js';

export interface ShutdownHooks {
  readonly onMarkNotReady?: () => Promise<void> | void;
  readonly onStopAcceptingWork?: () => Promise<void> | void;
  readonly onStopSchedulers?: () => Promise<void> | void;
  readonly onDrainWorkers?: () => Promise<void> | void;
  readonly onReleaseLeases?: () => Promise<void> | void;
  readonly onFlushTelemetry?: () => Promise<void> | void;
  readonly onCloseConnections?: () => Promise<void> | void;
}

export interface ShutdownReport {
  readonly success: boolean;
  readonly durationMs: number;
  readonly stepsCompleted: readonly string[];
  readonly errors: readonly string[];
}

export class GracefulShutdownCoordinator {
  private isShuttingDown = false;
  private readonly drainTimeoutMs: number;

  constructor(
    private readonly hooks: ShutdownHooks = {},
    options: { drainTimeoutMs?: number } = {}
  ) {
    this.drainTimeoutMs = options.drainTimeoutMs ?? 15000;
  }

  public get shuttingDown(): boolean {
    return this.isShuttingDown;
  }

  public async shutdown(reason: string = 'normal'): Promise<ShutdownReport> {
    if (this.isShuttingDown) {
      return {
        success: true,
        durationMs: 0,
        stepsCompleted: ['already_shutting_down'],
        errors: [],
      };
    }

    this.isShuttingDown = true;
    const startedAt = Date.now();
    const stepsCompleted: string[] = [];
    const errors: string[] = [];

    const executeStep = async (stepName: string, action?: () => Promise<void> | void) => {
      if (!action) return;
      try {
        await Promise.race([
          action(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Shutdown step '${stepName}' timed out`)), this.drainTimeoutMs)
          ),
        ]);
        stepsCompleted.push(stepName);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${stepName}] ${msg}`);
      }
    };

    // Step 1: Mark service as not ready
    await executeStep('mark_not_ready', this.hooks.onMarkNotReady);

    // Step 2: Stop accepting new external work
    await executeStep('stop_accepting_work', this.hooks.onStopAcceptingWork);

    // Step 3: Stop background schedulers
    await executeStep('stop_schedulers', this.hooks.onStopSchedulers);

    // Step 4: Drain workers & finish in-flight operations safely
    await executeStep('drain_workers', this.hooks.onDrainWorkers);

    // Step 5: Release coordination leases & step down leadership
    await executeStep('release_leases', this.hooks.onReleaseLeases);

    // Step 6: Flush telemetry & metrics
    await executeStep('flush_telemetry', this.hooks.onFlushTelemetry);

    // Step 7: Close storage & network connections
    await executeStep('close_connections', this.hooks.onCloseConnections);

    return {
      success: errors.length === 0,
      durationMs: Date.now() - startedAt,
      stepsCompleted,
      errors,
    };
  }
}
