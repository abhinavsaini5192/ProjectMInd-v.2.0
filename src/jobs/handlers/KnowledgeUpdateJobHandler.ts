import type { IJobHandler, JobExecutionContext } from '../registry/IJobHandler.js';
import type { Job } from '../models/Job.js';
import type { JobResult } from '../models/JobResult.js';
import type { IKnowledgeUpdateCoordinator } from '../../knowledge/update/interfaces/IKnowledgeUpdateCoordinator.js';
import type { CreateKnowledgeUpdateParams } from '../../knowledge/update/models/KnowledgeUpdate.js';
import { JobError } from '../models/JobError.js';

export class KnowledgeUpdateJobHandler implements IJobHandler<CreateKnowledgeUpdateParams> {
  constructor(private readonly coordinator: IKnowledgeUpdateCoordinator) {}

  public validate(job: Job<CreateKnowledgeUpdateParams>): void {
    if (!job.payload) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Knowledge update job requires a valid payload', false);
    }
    if (!job.payload.repositoryId && !job.repositoryId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Knowledge update job requires a repositoryId', false);
    }
  }

  public async execute(
    job: Job<CreateKnowledgeUpdateParams>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution started', false);
    }

    await context.updateProgress(10, 100, 'Starting knowledge update processing');

    const params: CreateKnowledgeUpdateParams = {
      ...job.payload,
      repositoryId: job.payload.repositoryId || job.repositoryId!,
    };

    const startTime = Date.now();
    const updateResult = await this.coordinator.processKnowledgeUpdate(params);
    const durationMs = Date.now() - startTime;

    await context.updateProgress(100, 100, 'Knowledge update completed');

    return {
      affectedResources: [params.repositoryId],
      data: {
        updateId: updateResult.updateId,
        status: updateResult.status,
        conflicts: updateResult.conflicts?.length ?? 0,
      },
      metrics: {
        durationMs,
        resourcesAffected: 1,
      },
    };
  }
}
