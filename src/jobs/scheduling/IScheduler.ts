import type { CreateJobParams, Job } from '../models/Job.js';

export interface RecurringScheduleInfo {
  readonly scheduleId: string;
  readonly intervalMs: number;
  readonly lastRunAt?: string | undefined;
  readonly runCount: number;
}

export interface IScheduler {
  scheduleOnce<T = Record<string, unknown>>(params: CreateJobParams<T>, delayMs: number): Promise<Job<T>>;
  scheduleRecurring<T = Record<string, unknown>>(
    scheduleId: string,
    intervalMs: number,
    paramsFactory: () => CreateJobParams<T>
  ): void;
  cancelSchedule(scheduleId: string): boolean;
  listSchedules(): readonly RecurringScheduleInfo[];
  stopAll(): void;
}

export const ISchedulerToken = Symbol('IScheduler');
