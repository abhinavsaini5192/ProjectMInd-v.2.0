import { randomUUID } from 'node:crypto';
import type { IJobDispatcher } from './IJobDispatcher.js';
import type { Job, CreateJobParams } from '../models/Job.js';
import type { IJobQueue } from '../queue/IJobQueue.js';
import type { IJobRepository } from '../persistence/IJobRepository.js';
import { JobAuthorizationValidator } from '../security/JobAuthorizationValidator.js';
import { isValidJobTransition } from '../models/JobStatus.js';
import { JobError } from '../models/JobError.js';
import type { JobTelemetry } from '../observability/JobTelemetry.js';

export class JobDispatcher implements IJobDispatcher {
  constructor(
    private readonly queue: IJobQueue,
    private readonly repository: IJobRepository,
    private readonly telemetry?: JobTelemetry | undefined
  ) {}

  public async dispatch<T = Record<string, unknown>>(params: CreateJobParams<T>): Promise<Job<T>> {
    // 1. Idempotency Check
    if (params.idempotencyKey) {
      const existing = await this.repository.getByIdempotencyKey(params.idempotencyKey, params.workspaceId);
      if (existing) {
        // Return existing job if non-terminal
        if (existing.status !== 'FAILED' && existing.status !== 'CANCELLED') {
          return existing as Job<T>;
        }
      }
    }

    const jobId = randomUUID();
    const now = new Date().toISOString();
    const delayMs = params.scheduledAt
      ? Math.max(0, new Date(params.scheduledAt).getTime() - Date.now())
      : 0;

    const initialStatus = delayMs > 0 ? 'SCHEDULED' : 'QUEUED';

    const job: Job<T> = {
      jobId,
      type: params.type,
      status: initialStatus,
      priority: params.priority ?? 'NORMAL',
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      sessionId: params.sessionId,
      taskId: params.taskId,
      correlationId: params.correlationId,
      traceId: params.traceId,
      createdAt: now,
      scheduledAt: params.scheduledAt,
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      timeoutMs: params.timeoutMs ?? 300000,
      idempotencyKey: params.idempotencyKey,
      parentJobId: params.parentJobId,
      dependencies: params.dependencies,
      payload: params.payload,
      version: 1,
    };

    // 2. Validate payload and scope
    JobAuthorizationValidator.validate(job as Job);

    // 3. Persist Job
    await this.repository.save(job as Job);

    // 4. Enqueue into Queue
    await this.queue.enqueue(jobId, job.priority, delayMs);

    this.telemetry?.recordJobEnqueued(job as Job);

    return job;
  }

  public async getJob(jobId: string): Promise<Job | null> {
    return this.repository.getById(jobId);
  }

  public async cancelJob(jobId: string, reason: string = 'User requested cancellation'): Promise<boolean> {
    const job = await this.repository.getById(jobId);
    if (!job) {
      throw new JobError('JOB_NOT_FOUND', `Job '${jobId}' was not found`, false);
    }

    if (!isValidJobTransition(job.status, 'CANCELLED')) {
      throw new JobError(
        'INVALID_JOB',
        `Cannot cancel job '${jobId}' from terminal status '${job.status}'`,
        false
      );
    }

    await this.repository.update(jobId, {
      status: 'CANCELLED',
      completedAt: new Date().toISOString(),
      error: {
        code: 'JOB_CANCELLED',
        message: reason,
        retryable: false,
      },
    });

    this.telemetry?.recordJobCancelled(job, reason);
    return true;
  }
}
