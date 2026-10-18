import type { InstanceState, InstanceRecord } from '../models/InstanceRecord.js';
import type { DistributedConfig } from '../models/DistributedConfig.js';
import type { IDistributedCoordinationBackend } from '../coordination/IDistributedCoordinationBackend.js';
import type { IDistributedLockManager } from '../locking/IDistributedLockManager.js';
import type { IDistributedServiceDiscovery } from '../discovery/IDistributedServiceDiscovery.js';

export interface RuntimeLifecycleObserver {
  onStateChanged?(from: InstanceState, to: InstanceState): void;
}

export class DistributedRuntimeLifecycle {
  private state: InstanceState = 'STARTING';
  private readonly config: DistributedConfig;
  private readonly backend: IDistributedCoordinationBackend;
  private readonly lockManager?: IDistributedLockManager | undefined;
  private readonly discovery?: IDistributedServiceDiscovery | undefined;
  private readonly observers = new Set<RuntimeLifecycleObserver>();
  private activeWorkCount = 0;
  private activeWorkDrainedResolver: (() => void) | null = null;
  private signalHandlers: { [signal: string]: () => void } = {};

  constructor(
    config: DistributedConfig,
    backend: IDistributedCoordinationBackend,
    lockManager?: IDistributedLockManager,
    discovery?: IDistributedServiceDiscovery
  ) {
    this.config = config;
    this.backend = backend;
    this.lockManager = lockManager;
    this.discovery = discovery;
  }

  public getState(): InstanceState {
    return this.state;
  }

  public canAcceptWork(): boolean {
    return this.state === 'READY';
  }

  public getActiveWorkCount(): number {
    return this.activeWorkCount;
  }

  public addObserver(observer: RuntimeLifecycleObserver): void {
    this.observers.add(observer);
  }

  public removeObserver(observer: RuntimeLifecycleObserver): void {
    this.observers.delete(observer);
  }

  private setState(next: InstanceState): void {
    const prev = this.state;
    this.state = next;
    for (const observer of this.observers) {
      try {
        observer.onStateChanged?.(prev, next);
      } catch {}
    }
  }

  /**
   * Initializes the distributed runtime, checks coordination health,
   * registers the instance in service discovery, and transitions to READY.
   */
  public async initialize(): Promise<void> {
    if (this.state !== 'STARTING') {
      throw new Error(`Cannot initialize distributed runtime from state '${this.state}'`);
    }

    this.setState('INITIALIZING');

    try {
      // 1. Check coordination backend health
      const health = await this.backend.healthCheck();
      if (!health.healthy) {
        throw new Error(`Coordination backend is unhealthy: ${health.message}`);
      }

      // 2. Register in service discovery if configured
      if (this.discovery) {
        await this.discovery.register(['core', 'locking', 'events'], {
          role: this.config.role,
          mode: this.config.mode,
        });
      }

      this.setState('READY');
    } catch (err) {
      this.setState('FAILED');
      throw err;
    }
  }

  /**
   * Tracks an active piece of work/task execution.
   * Throws an error if runtime is not in READY state.
   */
  public enterWork(): () => void {
    if (!this.canAcceptWork()) {
      throw new Error(`Cannot accept work: runtime is in state '${this.state}'`);
    }

    this.activeWorkCount++;
    let exited = false;

    return () => {
      if (exited) return;
      exited = true;
      this.activeWorkCount = Math.max(0, this.activeWorkCount - 1);
      if (this.activeWorkCount === 0 && this.activeWorkDrainedResolver) {
        this.activeWorkDrainedResolver();
      }
    };
  }

  /**
   * Gracefully drains and shuts down the runtime instance.
   */
  public async shutdown(): Promise<void> {
    if (this.state === 'STOPPED' || this.state === 'DRAINING') {
      return;
    }

    this.setState('DRAINING');

    // 1. Wait for active work to complete within shutdownTimeoutMs
    if (this.activeWorkCount > 0) {
      const deadline = Date.now() + this.config.shutdownTimeoutMs;
      await new Promise<void>((resolve) => {
        this.activeWorkDrainedResolver = resolve;
        const timer = setTimeout(() => {
          resolve();
        }, Math.max(0, deadline - Date.now()));
        timer.unref?.();
      });
    }

    // 2. Close lock manager and release all held locks
    if (this.lockManager) {
      try {
        await this.lockManager.close();
      } catch {}
    }

    // 3. Deregister from service discovery
    if (this.discovery) {
      try {
        await this.discovery.deregister();
        await this.discovery.close();
      } catch {}
    }

    // 4. Close coordination backend
    try {
      await this.backend.close();
    } catch {}

    this.setState('STOPPED');
  }

  /**
   * Binds process termination signals (SIGINT, SIGTERM) to trigger graceful shutdown.
   */
  public bindProcessSignals(): void {
    const handleSignal = async (sig: string) => {
      try {
        await this.shutdown();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    };

    this.signalHandlers['SIGINT'] = () => handleSignal('SIGINT');
    this.signalHandlers['SIGTERM'] = () => handleSignal('SIGTERM');

    process.once('SIGINT', this.signalHandlers['SIGINT']);
    process.once('SIGTERM', this.signalHandlers['SIGTERM']);
  }

  /**
   * Unbinds process termination signals (useful for test isolation).
   */
  public unbindProcessSignals(): void {
    if (this.signalHandlers['SIGINT']) {
      process.off('SIGINT', this.signalHandlers['SIGINT']);
    }
    if (this.signalHandlers['SIGTERM']) {
      process.off('SIGTERM', this.signalHandlers['SIGTERM']);
    }
    this.signalHandlers = {};
  }
}
