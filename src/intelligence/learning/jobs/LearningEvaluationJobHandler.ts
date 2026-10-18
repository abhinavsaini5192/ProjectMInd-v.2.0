import type { IJobHandler, JobExecutionContext } from '../../../jobs/registry/IJobHandler.js';
import type { Job } from '../../../jobs/models/Job.js';
import type { JobResult } from '../../../jobs/models/JobResult.js';
import { JobError } from '../../../jobs/models/JobError.js';
import type { ILearningIntelligenceService } from '../interfaces/ILearningIntelligenceService.js';

export interface LearningEvaluationJobPayload {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly candidateId: string;
}

export class LearningEvaluationJobHandler implements IJobHandler<LearningEvaluationJobPayload> {
  constructor(private readonly learningService: ILearningIntelligenceService) {}

  public validate(job: Job<LearningEvaluationJobPayload>): void {
    if (!job.payload?.candidateId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Learning evaluation requires candidateId.', false);
    }
  }

  public async execute(
    job: Job<LearningEvaluationJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const { candidateId } = job.payload;
    const startTime = Date.now();

    await context.updateProgress(20, 100, `Evaluating candidate ${candidateId}`);

    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution', false);
    }

    const evaluation = await this.learningService.evaluateCandidate(candidateId);
    await context.updateProgress(100, 100, `Completed evaluation: score ${evaluation.overallScore}`);

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        overallScore: evaluation.overallScore,
        isAccepted: evaluation.isAccepted ? 1 : 0,
      },
      output: {
        evaluationId: evaluation.evaluationId,
        recommendedAction: evaluation.recommendedAction,
        dimensions: evaluation.dimensions,
      },
    };
  }
}
