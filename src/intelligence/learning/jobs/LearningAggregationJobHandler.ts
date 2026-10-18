import type { IJobHandler, JobExecutionContext } from '../../../jobs/registry/IJobHandler.js';
import type { Job } from '../../../jobs/models/Job.js';
import type { JobResult } from '../../../jobs/models/JobResult.js';
import { JobError } from '../../../jobs/models/JobError.js';
import type { ILearningIntelligenceService } from '../interfaces/ILearningIntelligenceService.js';

export interface LearningAggregationJobPayload {
  readonly workspaceId: string;
  readonly projectId: string;
}

export class LearningAggregationJobHandler implements IJobHandler<LearningAggregationJobPayload> {
  constructor(private readonly learningService: ILearningIntelligenceService) {}

  public validate(job: Job<LearningAggregationJobPayload>): void {
    if (!job.payload?.workspaceId || !job.payload?.projectId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Learning aggregation requires workspaceId and projectId.', false);
    }
  }

  public async execute(
    job: Job<LearningAggregationJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const { workspaceId, projectId } = job.payload;
    const startTime = Date.now();

    await context.updateProgress(10, 100, 'Starting feedback signal extraction');

    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution', false);
    }

    const signals = await this.learningService.generateSignals(workspaceId, projectId);
    await context.updateProgress(50, 100, `Extracted ${signals.length} learning signals`);

    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled during candidate generation', false);
    }

    const candidates = await this.learningService.generateCandidates(workspaceId, projectId);
    await context.updateProgress(100, 100, `Generated and evaluated ${candidates.length} candidates`);

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        signalsExtracted: signals.length,
        candidatesGenerated: candidates.length,
      },
      output: {
        signalIds: signals.map((s) => s.id),
        candidateIds: candidates.map((c) => c.id),
      },
    };
  }
}
