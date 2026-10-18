import type { IJobHandler, JobExecutionContext } from '../registry/IJobHandler.js';
import type { Job } from '../models/Job.js';
import type { JobResult } from '../models/JobResult.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../context/models/ContextRequest.js';
import { JobError } from '../models/JobError.js';

export class ContextRefreshJobHandler implements IJobHandler<ContextRequest> {
  constructor(private readonly orchestrator: IContextOrchestrator) {}

  public validate(job: Job<ContextRequest>): void {
    if (!job.payload || !job.payload.workspaceId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Context refresh job requires a valid ContextRequest with workspaceId', false);
    }
  }

  public async execute(
    job: Job<ContextRequest>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution', false);
    }

    await context.updateProgress(20, 100, 'Orchestrating context');

    const response = await this.orchestrator.orchestrateContext(job.payload);

    await context.updateProgress(100, 100, 'Context refreshed');

    const pkg = (response.package ?? (response as any).contextPackage) as any;
    const featuresCount = pkg?.features?.length ?? pkg?.items?.length ?? 0;
    const resourcesCount = pkg?.resources?.length ?? 0;
    const itemCount = featuresCount + resourcesCount;
    const totalTokens = pkg?.estimatedTokens ?? pkg?.totalTokens ?? 0;
    const packageId = pkg?.packageId ?? 'unknown';
    const durationMs = response.durationMs ?? 0;

    return {
      affectedResources: [job.payload.workspaceId, ...(job.payload.repositoryId ? [job.payload.repositoryId] : [])],
      data: {
        packageId,
        itemCount,
        totalTokens,
      },
      metrics: {
        tokensUsed: totalTokens,
        itemsCount: itemCount,
        durationMs,
      },
    };
  }
}
