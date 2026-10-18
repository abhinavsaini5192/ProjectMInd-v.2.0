import type { IJobHandler, JobExecutionContext } from '../../../jobs/registry/IJobHandler.js';
import type { Job } from '../../../jobs/models/Job.js';
import type { JobResult } from '../../../jobs/models/JobResult.js';
import { JobError } from '../../../jobs/models/JobError.js';
import type { ILearningStore } from '../interfaces/ILearningStore.js';

export interface LearningMaintenanceJobPayload {
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
}

export class LearningMaintenanceJobHandler implements IJobHandler<LearningMaintenanceJobPayload> {
  constructor(private readonly learningStore: ILearningStore) {}

  public validate(job: Job<LearningMaintenanceJobPayload>): void {
    if (!job.payload?.workspaceId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Learning maintenance requires workspaceId.', false);
    }
  }

  public async execute(
    job: Job<LearningMaintenanceJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const { workspaceId, projectId } = job.payload;
    const startTime = Date.now();
    const now = Date.now();

    await context.updateProgress(10, 100, 'Checking for expired candidates');

    const candidates = await this.learningStore.queryCandidates({
      workspaceId,
      projectId,
      status: ['PROPOSED', 'ACCEPTED'],
      limit: 1000,
    });

    let expiredCount = 0;
    for (const cand of candidates) {
      if (cand.validUntil && cand.validUntil < now) {
        await this.learningStore.updateCandidate({
          ...cand,
          evaluationStatus: 'EXPIRED',
          updatedAt: now,
        });
        expiredCount++;
      }
    }

    await context.updateProgress(100, 100, `Maintenance complete. Expired ${expiredCount} candidates.`);

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        expiredCount,
        inspectedCandidates: candidates.length,
      },
      output: {
        expiredCandidates: expiredCount,
      },
    };
  }
}
