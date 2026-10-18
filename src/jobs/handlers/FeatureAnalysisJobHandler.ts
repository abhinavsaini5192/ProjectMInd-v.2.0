import type { IJobHandler, JobExecutionContext } from '../registry/IJobHandler.js';
import type { Job } from '../models/Job.js';
import type { JobResult } from '../models/JobResult.js';
import { JobError } from '../models/JobError.js';

export interface FeatureAnalysisJobPayload {
  readonly featureId: string;
  readonly analysisType: 'DISCOVERY' | 'MAPPING' | 'DEPENDENCY' | 'BEHAVIOR' | 'IMPACT' | 'HEALTH';
  readonly scope?: readonly string[] | undefined;
}

export class FeatureAnalysisJobHandler implements IJobHandler<FeatureAnalysisJobPayload> {
  constructor(
    private readonly featureService?: {
      analyzeFeature: (featureId: string, analysisType: string) => Promise<{ nodesEvaluated: number }>;
    } | undefined
  ) {}

  public validate(job: Job<FeatureAnalysisJobPayload>): void {
    if (!job.payload || !job.payload.featureId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Feature analysis job requires featureId', false);
    }
  }

  public async execute(
    job: Job<FeatureAnalysisJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution', false);
    }

    await context.updateProgress(10, 100, `Starting ${job.payload.analysisType} analysis`);

    let nodesEvaluated = 1;
    if (this.featureService) {
      const res = await this.featureService.analyzeFeature(job.payload.featureId, job.payload.analysisType);
      nodesEvaluated = res.nodesEvaluated;
    }

    await context.updateProgress(100, 100, 'Feature analysis completed');

    return {
      affectedResources: [job.payload.featureId],
      data: {
        featureId: job.payload.featureId,
        analysisType: job.payload.analysisType,
        nodesEvaluated,
      },
      metrics: {
        nodesEvaluated,
      },
    };
  }
}
