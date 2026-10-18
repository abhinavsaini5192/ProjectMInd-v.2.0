import type { IJobHandler, JobExecutionContext } from '../../jobs/registry/IJobHandler.js';
import type { Job } from '../../jobs/models/Job.js';
import type { JobResult } from '../../jobs/models/JobResult.js';
import { JobError } from '../../jobs/models/JobError.js';
import type { IAnalyticsStore } from '../interfaces/IAnalyticsStore.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { ANALYTICS_EVENT_NAMES } from '../events/AnalyticsEvents.js';

export interface AnalyticsMaintenanceJobPayload {
  readonly retentionDays?: number | undefined;
}

export class AnalyticsMaintenanceJobHandler implements IJobHandler<AnalyticsMaintenanceJobPayload> {
  constructor(
    private readonly store: IAnalyticsStore,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public validate(job: Job<AnalyticsMaintenanceJobPayload>): void {
    if (job.payload?.retentionDays !== undefined && job.payload.retentionDays <= 0) {
      throw new JobError('INVALID_PAYLOAD', 'retentionDays must be a positive number', false);
    }
  }

  public async execute(
    job: Job<AnalyticsMaintenanceJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const startTime = Date.now();
    const retentionDays = job.payload?.retentionDays ?? 90;
    const cutoffMs = Date.now() - retentionDays * 86_400_000;

    await context.updateProgress(20, 100, `Pruning analytics records older than ${retentionDays} days`);

    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Maintenance cancelled', false);
    }

    const prunedCount = await this.store.pruneRecords(cutoffMs);

    await context.updateProgress(100, 100, 'Maintenance completed successfully');

    if (this.eventBus) {
      this.eventBus.publish(ANALYTICS_EVENT_NAMES.MAINTENANCE_EXECUTED, {
        recordsPruned: prunedCount,
        snapshotsRetained: 0,
        durationMs: Date.now() - startTime,
        executedAt: Date.now(),
      });
    }

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        recordsPruned: prunedCount,
      },
      output: {
        retentionDays,
        prunedCount,
      },
    };
  }
}
