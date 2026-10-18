import type { IScheduler, RecurringScheduleInfo } from './IScheduler.js';
import type { CreateJobParams, Job } from '../models/Job.js';
import type { IJobDispatcher } from '../dispatch/IJobDispatcher.js';
import { JobError } from '../models/JobError.js';

interface ActiveSchedule {
  readonly scheduleId: string;
  readonly intervalMs: number;
  readonly timerId: NodeJS.Timeout;
  lastRunAt?: string | undefined;
  runCount: number;
}

export class JobScheduler implements IScheduler {
  private readonly schedules = new Map<string, ActiveSchedule>();

  constructor(private readonly dispatcher: IJobDispatcher) {}

  public async scheduleOnce<T = Record<string, unknown>>(params: CreateJobParams<T>, delayMs: number): Promise<Job<T>> {
    const scheduledAt = new Date(Date.now() + Math.max(0, delayMs)).toISOString();
    return this.dispatcher.dispatch({
      ...params,
      scheduledAt,
    });
  }

  public scheduleRecurring<T = Record<string, unknown>>(
    scheduleId: string,
    intervalMs: number,
    paramsFactory: () => CreateJobParams<T>
  ): void {
    if (this.schedules.has(scheduleId)) {
      throw new JobError('INVALID_JOB', `Recurring schedule '${scheduleId}' already exists`, false);
    }

    const boundedInterval = Math.max(100, intervalMs);

    const timerId = setInterval(async () => {
      const active = this.schedules.get(scheduleId);
      if (!active) return;

      try {
        const params = paramsFactory();
        await this.dispatcher.dispatch(params);
        active.lastRunAt = new Date().toISOString();
        active.runCount++;
      } catch {
        // Scheduler fail-safe
      }
    }, boundedInterval);

    this.schedules.set(scheduleId, {
      scheduleId,
      intervalMs: boundedInterval,
      timerId,
      runCount: 0,
    });
  }

  public cancelSchedule(scheduleId: string): boolean {
    const active = this.schedules.get(scheduleId);
    if (!active) return false;

    clearInterval(active.timerId);
    return this.schedules.delete(scheduleId);
  }

  public listSchedules(): readonly RecurringScheduleInfo[] {
    return Array.from(this.schedules.values()).map((s) => ({
      scheduleId: s.scheduleId,
      intervalMs: s.intervalMs,
      lastRunAt: s.lastRunAt,
      runCount: s.runCount,
    }));
  }

  public stopAll(): void {
    for (const schedule of this.schedules.values()) {
      clearInterval(schedule.timerId);
    }
    this.schedules.clear();
  }
}
