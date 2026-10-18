import type { WorkerInfo } from './WorkerState.js';

export interface WorkerPoolStats {
  readonly totalWorkers: number;
  readonly activeWorkers: number;
  readonly idleWorkers: number;
  readonly maxConcurrency: number;
  readonly maxPerWorkspace: number;
}

export interface IWorkerPool {
  start(): Promise<void>;
  stop(gracePeriodMs?: number): Promise<void>;
  getStats(): WorkerPoolStats;
  getWorkerInfos(): readonly WorkerInfo[];
}

export const IWorkerPoolToken = Symbol('IWorkerPool');
