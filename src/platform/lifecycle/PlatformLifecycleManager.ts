import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export type PlatformState = 'CREATED' | 'STARTING' | 'READY' | 'STOPPING' | 'STOPPED' | 'FAILED';

export interface ShutdownHooks {
  readonly onStopInboundRequests?: () => Promise<void> | void;
  readonly onStopAgentTasks?: () => Promise<void> | void;
  readonly onPauseRuntime?: () => Promise<void> | void;
  readonly onCreateCheckpoint?: () => Promise<void> | void;
  readonly onFlushTelemetry?: () => Promise<void> | void;
  readonly onCloseAdapters?: () => Promise<void> | void;
  readonly onCloseEventBus?: () => Promise<void> | void;
  readonly onCloseCache?: () => Promise<void> | void;
  readonly onCloseStorage?: () => Promise<void> | void;
}

export class PlatformLifecycleManager {
  private state: PlatformState = 'CREATED';
  private shutdownPromise?: Promise<void> | undefined;

  constructor(
    private readonly shutdownTimeoutMs: number = 15000,
    private readonly hooks: ShutdownHooks = {},
    private readonly logger?: ILogger | undefined
  ) {}

  public getState(): PlatformState {
    return this.state;
  }

  public setState(newState: PlatformState): void {
    this.state = newState;
  }

  public async shutdown(reason?: string): Promise<void> {
    if (this.state === 'STOPPED') {
      return;
    }

    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.state = 'STOPPING';
    this.logger?.info({
      component: 'PlatformLifecycleManager',
      operation: 'shutdown',
      message: `Initiating platform shutdown: ${reason ?? 'normal shutdown'}`,
    });

    const timeoutHandle = this.createTimeoutPromise();
    this.shutdownPromise = Promise.race([
      this.executeShutdownSequence(reason),
      timeoutHandle.promise,
    ]).finally(() => {
      timeoutHandle.cancel();
    });

    await this.shutdownPromise;
    this.state = 'STOPPED';

    this.logger?.info({
      component: 'PlatformLifecycleManager',
      operation: 'shutdown',
      message: 'Platform shutdown completed successfully.',
    });
  }

  private async executeShutdownSequence(_reason?: string): Promise<void> {
    // 1. Stop accepting new inbound requests
    await this.safeExecute('Stop inbound requests', this.hooks.onStopInboundRequests);

    // 2. Stop new agent tasks
    await this.safeExecute('Stop new agent tasks', this.hooks.onStopAgentTasks);

    // 3. Pause / finish safe runtime operations
    await this.safeExecute('Pause runtime operations', this.hooks.onPauseRuntime);

    // 4. Checkpoint active agent sessions & tasks
    await this.safeExecute('Checkpoint active runtime state', this.hooks.onCreateCheckpoint);

    // 5. Flush telemetry & metrics
    await this.safeExecute('Flush telemetry and metrics', this.hooks.onFlushTelemetry);

    // 6. Close adapters
    await this.safeExecute('Close agent adapters', this.hooks.onCloseAdapters);

    // 7. Close EventBus
    await this.safeExecute('Close event bus', this.hooks.onCloseEventBus);

    // 8. Close cache
    await this.safeExecute('Close cache layer', this.hooks.onCloseCache);

    // 9. Close storage
    await this.safeExecute('Close storage provider', this.hooks.onCloseStorage);
  }

  private async safeExecute(stepName: string, action?: (() => Promise<void> | void) | undefined): Promise<void> {
    if (!action) return;
    try {
      await action();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger?.warn({
        component: 'PlatformLifecycleManager',
        operation: 'shutdown_step',
        message: `Warning during shutdown step '${stepName}': ${msg}`,
      });
    }
  }

  private createTimeoutPromise(): { promise: Promise<void>; cancel: () => void } {
    let timer: NodeJS.Timeout | undefined;
    const promise = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        this.logger?.warn({
          component: 'PlatformLifecycleManager',
          operation: 'shutdown_timeout',
          message: `Graceful shutdown exceeded timeout of ${this.shutdownTimeoutMs}ms. Proceeding to force stop.`,
        });
        resolve();
      }, this.shutdownTimeoutMs);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    });

    return {
      promise,
      cancel: () => {
        if (timer) {
          clearTimeout(timer);
        }
      },
    };
  }
}
