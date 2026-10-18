import type { IJobHandler, JobExecutionContext } from '../../jobs/registry/IJobHandler.js';
import type { Job } from '../../jobs/models/Job.js';
import type { JobResult } from '../../jobs/models/JobResult.js';
import { JobError } from '../../jobs/models/JobError.js';
import type { IAnalyticsService } from '../interfaces/IAnalyticsService.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindowType } from '../models/AnalyticsSnapshot.js';

export interface AnalyticsSnapshotJobPayload {
  readonly scope?: AnalyticsScopeRef | undefined;
  readonly windowType?: TimeWindowType | undefined;
}

export class AnalyticsSnapshotJobHandler implements IJobHandler<AnalyticsSnapshotJobPayload> {
  constructor(private readonly analyticsService: IAnalyticsService) {}

  public validate(job: Job<AnalyticsSnapshotJobPayload>): void {
    // Payload is optional, defaults to global or workspace snapshot
  }

  public async execute(
    job: Job<AnalyticsSnapshotJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    const startTime = Date.now();
    const scope: AnalyticsScopeRef = job.payload?.scope ?? { scopeType: 'INSTANCE' };
    const windowType = job.payload?.windowType ?? 'LAST_24H';

    await context.updateProgress(10, 100, 'Starting snapshot generation');

    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before snapshot execution', false);
    }

    const snapshot = await this.analyticsService.generateSnapshot(scope, { type: windowType });

    await context.updateProgress(100, 100, 'Snapshot generated successfully');

    return {
      durationMs: Date.now() - startTime,
      metrics: {
        metricCount: Object.keys(snapshot.metrics).length,
        coverageRatio: snapshot.dataQuality.coverageRatio,
      },
      output: {
        snapshotId: snapshot.snapshotId,
        qualityStatus: snapshot.dataQuality.status,
      },
    };
  }
}
