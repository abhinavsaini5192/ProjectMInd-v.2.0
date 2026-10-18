import type { IWorkerPool, WorkerPoolStats } from './IWorkerPool.js';
import type { WorkerInfo } from './WorkerState.js';
import { Worker, type WorkerOptions } from './Worker.js';
import type { IJobQueue } from '../queue/IJobQueue.js';
import type { IJobRepository } from '../persistence/IJobRepository.js';
import type { IJobRegistry } from '../registry/IJobRegistry.js';
import type { IJobLeaseManager } from '../recovery/IJobLeaseManager.js';
import type { IDeadLetterQueue } from '../recovery/IDeadLetterQueue.js';

export interface WorkerPoolOptions {
  readonly concurrency?: number | undefined;
  readonly maxPerWorkspace?: number | undefined;
  readonly workerOptions?: WorkerOptions | undefined;
}

export class WorkerPool implements IWorkerPool {
  private readonly workers: Worker[] = [];
  private readonly maxConcurrency: number;
  private readonly maxPerWorkspace: number;

  constructor(
    queue: IJobQueue,
    repository: IJobRepository,
    registry: IJobRegistry,
    leaseManager: IJobLeaseManager,
    deadLetterQueue: IDeadLetterQueue,
    options: WorkerPoolOptions = {}
  ) {
    this.maxConcurrency = Math.max(1, options.concurrency ?? 4);
    this.maxPerWorkspace = Math.max(1, options.maxPerWorkspace ?? 2);

    for (let i = 0; i < this.maxConcurrency; i++) {
      const worker = new Worker(queue, repository, registry, leaseManager, deadLetterQueue, {
        ...(options.workerOptions ?? {}),
        workerId: `pool-worker-${i + 1}`,
      });
      this.workers.push(worker);
    }
  }

  public async start(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.start()));
  }

  public async stop(gracePeriodMs: number = 5000): Promise<void> {
    await Promise.all(this.workers.map((w) => w.stop(gracePeriodMs)));
  }

  public getStats(): WorkerPoolStats {
    let active = 0;
    let idle = 0;

    for (const w of this.workers) {
      if (w.state === 'BUSY') active++;
      else if (w.state === 'IDLE') idle++;
    }

    return {
      totalWorkers: this.workers.length,
      activeWorkers: active,
      idleWorkers: idle,
      maxConcurrency: this.maxConcurrency,
      maxPerWorkspace: this.maxPerWorkspace,
    };
  }

  public getWorkerInfos(): readonly WorkerInfo[] {
    return this.workers.map((w) => w.getInfo());
  }
}
