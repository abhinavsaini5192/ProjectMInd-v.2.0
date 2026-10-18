import type { IJobHandler, JobExecutionContext } from '../registry/IJobHandler.js';
import type { Job } from '../models/Job.js';
import type { JobResult } from '../models/JobResult.js';
import { JobError } from '../models/JobError.js';

export interface MaintenanceJobPayload {
  readonly action: 'INTEGRITY_CHECK' | 'RETENTION_CLEANUP' | 'PRUNE_DEAD_LETTERS' | 'OPTIMIZE_STORAGE';
  readonly dryRun?: boolean | undefined;
}

export class MaintenanceJobHandler implements IJobHandler<MaintenanceJobPayload> {
  constructor(private readonly storageService?: { performMaintenance: (action: string) => Promise<{ itemsProcessed: number }> } | undefined) {}

  public validate(job: Job<MaintenanceJobPayload>): void {
    if (!job.payload || !job.payload.action) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Maintenance job requires an action', false);
    }
  }

  public async execute(
    job: Job<MaintenanceJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution', false);
    }

    await context.updateProgress(30, 100, `Running maintenance: ${job.payload.action}`);

    let itemsProcessed = 0;
    if (this.storageService) {
      const res = await this.storageService.performMaintenance(job.payload.action);
      itemsProcessed = res.itemsProcessed;
    }

    await context.updateProgress(100, 100, 'Maintenance completed');

    return {
      affectedResources: [job.workspaceId],
      data: {
        action: job.payload.action,
        dryRun: job.payload.dryRun ?? false,
        itemsProcessed,
      },
      metrics: {
        itemsProcessed,
      },
    };
  }
}
