import type { WorkerInfo, WorkerState } from './WorkerState.js';

export interface IWorker {
  readonly workerId: string;
  readonly state: WorkerState;
  start(): Promise<void>;
  stop(gracePeriodMs?: number): Promise<void>;
  processNext(): Promise<boolean>;
  getInfo(): WorkerInfo;
}

export const IWorkerToken = Symbol('IWorker');
