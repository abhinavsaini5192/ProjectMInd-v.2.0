export type WorkerState = 'IDLE' | 'BUSY' | 'PAUSED' | 'STOPPING' | 'STOPPED';

export interface WorkerInfo {
  readonly workerId: string;
  readonly state: WorkerState;
  readonly currentJobId?: string | undefined;
  readonly startedAt: string;
  readonly completedJobsCount: number;
  readonly failedJobsCount: number;
}
