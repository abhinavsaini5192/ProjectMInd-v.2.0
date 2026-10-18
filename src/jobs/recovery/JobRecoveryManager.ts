import type { IJobLeaseManager } from './IJobLeaseManager.js';
import type { IDeadLetterQueue } from './IDeadLetterQueue.js';
import type { IJobQueue } from '../queue/IJobQueue.js';
import type { IJobRepository } from '../persistence/IJobRepository.js';

export class JobRecoveryManager {
  constructor(
    private readonly leaseManager: IJobLeaseManager,
    private readonly jobQueue: IJobQueue,
    private readonly deadLetterQueue: IDeadLetterQueue,
    private readonly jobRepository: IJobRepository
  ) {}

  public async recoverStaleJobs(): Promise<{
    readonly recoveredCount: number;
    readonly deadLetteredCount: number;
  }> {
    const expiredJobIds = await this.leaseManager.getExpiredJobIds();
    let recoveredCount = 0;
    let deadLetteredCount = 0;

    for (const jobId of expiredJobIds) {
      const job = await this.jobRepository.getById(jobId);
      if (!job || job.status !== 'RUNNING') {
        // Not running or not found, just clean up lease
        const holder = await this.leaseManager.getLeaseHolder(jobId);
        if (holder) await this.leaseManager.releaseLease(jobId, holder);
        continue;
      }

      const holder = await this.leaseManager.getLeaseHolder(jobId);
      if (holder) await this.leaseManager.releaseLease(jobId, holder);

      if (job.retryCount < job.maxRetries) {
        // Requeue for retry
        const updated = await this.jobRepository.update(jobId, {
          status: 'QUEUED',
          retryCount: job.retryCount + 1,
        });

        if (updated) {
          await this.jobQueue.enqueue(jobId, job.priority);
          recoveredCount++;
        }
      } else {
        // Retries exhausted, dead letter
        await this.jobRepository.update(jobId, {
          status: 'DEAD_LETTERED',
          completedAt: new Date().toISOString(),
          error: {
            code: 'JOB_RETRY_EXHAUSTED',
            message: 'Worker lease expired and max retries were exhausted',
            retryable: false,
          },
        });

        await this.deadLetterQueue.record({
          jobId,
          type: job.type,
          workspaceId: job.workspaceId,
          repositoryId: job.repositoryId,
          failureReason: 'Worker lease expired and max retries exhausted',
          errorCode: 'JOB_RETRY_EXHAUSTED',
          retryCount: job.retryCount,
          correlationId: job.correlationId,
          payload: job.payload,
        });

        deadLetteredCount++;
      }
    }

    return { recoveredCount, deadLetteredCount };
  }
}
