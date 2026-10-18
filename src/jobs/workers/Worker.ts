import { randomUUID } from 'node:crypto';
import type { IWorker } from './IWorker.js';
import type { WorkerInfo, WorkerState } from './WorkerState.js';
import type { IJobQueue } from '../queue/IJobQueue.js';
import type { IJobRepository } from '../persistence/IJobRepository.js';
import type { IJobRegistry } from '../registry/IJobRegistry.js';
import type { IJobLeaseManager } from '../recovery/IJobLeaseManager.js';
import type { IDeadLetterQueue } from '../recovery/IDeadLetterQueue.js';
import type { RetryPolicy } from '../retry/RetryPolicy.js';
import { DEFAULT_RETRY_POLICY } from '../retry/RetryPolicy.js';
import { computeBackoffDelay } from '../retry/BackoffStrategy.js';
import { JobAuthorizationValidator } from '../security/JobAuthorizationValidator.js';
import { JobError } from '../models/JobError.js';
import { createJobProgress } from '../models/JobProgress.js';
import type { JobExecutionContext } from '../registry/IJobHandler.js';
import type { JobTelemetry } from '../observability/JobTelemetry.js';
import { CorrelationContext } from '../../observability/correlation/CorrelationContext.js';


export interface WorkerOptions {
  readonly workerId?: string | undefined;
  readonly leaseTtlMs?: number | undefined;
  readonly retryPolicy?: RetryPolicy | undefined;
  readonly pollIntervalMs?: number | undefined;
  readonly telemetry?: JobTelemetry | undefined;
}

export class Worker implements IWorker {
  public readonly workerId: string;
  private _state: WorkerState = 'IDLE';
  private currentJobId?: string | undefined;
  private currentAbortController?: AbortController | undefined;
  private readonly startedAt: string;
  private completedCount = 0;
  private failedCount = 0;
  private isRunningLoop = false;

  private readonly leaseTtlMs: number;
  private readonly retryPolicy: RetryPolicy;
  private readonly pollIntervalMs: number;
  private readonly telemetry?: JobTelemetry | undefined;

  constructor(
    private readonly queue: IJobQueue,
    private readonly repository: IJobRepository,
    private readonly registry: IJobRegistry,
    private readonly leaseManager: IJobLeaseManager,
    private readonly deadLetterQueue: IDeadLetterQueue,
    options: WorkerOptions = {}
  ) {
    this.workerId = options.workerId ?? `worker-${randomUUID().substring(0, 8)}`;
    this.leaseTtlMs = options.leaseTtlMs ?? 60000;
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.pollIntervalMs = options.pollIntervalMs ?? 50;
    this.telemetry = options.telemetry;
    this.startedAt = new Date().toISOString();
  }

  public get state(): WorkerState {
    return this._state;
  }

  public async start(): Promise<void> {
    if (this.isRunningLoop) return;
    this.isRunningLoop = true;
    this._state = 'IDLE';

    // Start background polling loop
    this.runLoop().catch(() => {
      // Worker loop safe termination
    });
  }

  public async stop(gracePeriodMs: number = 5000): Promise<void> {
    this.isRunningLoop = false;
    this._state = 'STOPPING';

    if (this.currentAbortController) {
      // Cooperative cancellation
      this.currentAbortController.abort();
    }

    const startWait = Date.now();
    while (this.currentJobId && Date.now() - startWait < gracePeriodMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    this._state = 'STOPPED';
  }

  public getInfo(): WorkerInfo {
    return {
      workerId: this.workerId,
      state: this._state,
      currentJobId: this.currentJobId,
      startedAt: this.startedAt,
      completedJobsCount: this.completedCount,
      failedJobsCount: this.failedCount,
    };
  }

  public async processNext(): Promise<boolean> {
    if (this._state === 'STOPPING' || this._state === 'STOPPED') {
      return false;
    }

    const message = await this.queue.dequeue(this.leaseTtlMs);
    if (!message) {
      this._state = 'IDLE';
      return false;
    }

    this._state = 'BUSY';
    this.currentJobId = message.jobId;

    try {
      const job = await this.repository.getById(message.jobId);
      if (!job) {
        // Job record missing from storage; acknowledge queue to avoid poison loop
        await this.queue.acknowledge(message.receiptHandle);
        return true;
      }

      // Check if job is already in terminal state
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED' || job.status === 'DEAD_LETTERED') {
        await this.queue.acknowledge(message.receiptHandle);
        return true;
      }

      // Check dependencies (Section 32, 33)
      if (job.dependencies && job.dependencies.length > 0) {
        const predecessorsReady = await this.checkDependencies(job.dependencies);
        if (!predecessorsReady) {
          // Predecessors not yet completed, requeue with delay
          await this.queue.requeue(message.receiptHandle, 1000);
          return true;
        }
      }

      // Acquire Lease
      const leaseAcquired = await this.leaseManager.acquireLease(job.jobId, this.workerId, this.leaseTtlMs);
      if (!leaseAcquired) {
        // Another worker holds lease, requeue
        await this.queue.requeue(message.receiptHandle, 500);
        return true;
      }

      // Validate security and payload
      JobAuthorizationValidator.validate(job);

      // Check Handler Registration
      const handler = this.registry.getHandler(job.type);
      if (!handler) {
        throw new JobError('UNKNOWN_JOB_TYPE', `No handler registered for job type '${job.type}'`, false);
      }

      // Transition to RUNNING
      await this.repository.update(job.jobId, {
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        workerId: this.workerId,
      });

      const startTimeMs = Date.now();
      this.currentAbortController = new AbortController();

      // Setup Timeout race
      const timeoutMs = job.timeoutMs > 0 ? job.timeoutMs : 300000;
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (this.currentAbortController) this.currentAbortController.abort();
          reject(new JobError('JOB_TIMEOUT', `Job exceeded timeout of ${timeoutMs}ms`, true));
        }, timeoutMs);
      });

      // Context for handler
      const execContext: JobExecutionContext = {
        signal: this.currentAbortController.signal,
        workerId: this.workerId,
        updateProgress: async (completed, total, msg) => {
          const progress = createJobProgress(completed, total, msg);
          await this.repository.update(job.jobId, { progress });
        },
        log: () => {},
      };

      // Restore correlation context for worker execution
      const jobCorrelationContext = CorrelationContext.createChildContext({
        correlationId: job.correlationId,
        causationId: job.parentJobId ?? job.jobId,
        traceId: job.traceId,
        jobId: job.jobId,
        attemptNumber: job.retryCount + 1,
        workspaceId: job.workspaceId,
        repositoryId: job.repositoryId,
        role: 'worker',
      });

      return await CorrelationContext.run(jobCorrelationContext, async () => {
        try {
          await handler.validate(job);
          const resultData = await Promise.race([
            handler.execute(job, execContext),
            timeoutPromise,
          ]);

          clearTimeout(timeoutId);

          // Success!
          const durationMs = Date.now() - startTimeMs;
          await this.repository.update(job.jobId, {
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
            result: {
              ...resultData,
              jobId: job.jobId,
              status: 'COMPLETED',
              completedAt: new Date().toISOString(),
            },
          });

          await this.queue.acknowledge(message.receiptHandle);
          await this.leaseManager.releaseLease(job.jobId, this.workerId);
          this.completedCount++;

          this.telemetry?.recordJobExecution(job, durationMs, true);
          return true;
        } catch (err: unknown) {
          clearTimeout(timeoutId);
          throw err;
        }
      });
    } catch (err: unknown) {
      await this.handleJobFailure(message.jobId, message.receiptHandle, err);
      return true;
    } finally {
      this.currentJobId = undefined;
      this.currentAbortController = undefined;
      this._state = 'IDLE';
    }
  }

  private async checkDependencies(dependencies: readonly string[]): Promise<boolean> {
    for (const depId of dependencies) {
      const depJob = await this.repository.getById(depId);
      if (!depJob || depJob.status !== 'COMPLETED') {
        return false;
      }
    }
    return true;
  }

  private async handleJobFailure(jobId: string, receiptHandle: string, error: unknown): Promise<void> {
    this.failedCount++;
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = error instanceof JobError ? error.code : 'HANDLER_EXECUTION_FAILED';
    const isRetryable = this.retryPolicy.isRetryable(error);

    const job = await this.repository.getById(jobId);
    if (!job) {
      await this.queue.acknowledge(receiptHandle);
      await this.leaseManager.releaseLease(jobId, this.workerId);
      return;
    }

    const currentRetries = job.retryCount;
    const canRetry = isRetryable && currentRetries < job.maxRetries;

    if (canRetry) {
      const nextAttempt = currentRetries + 1;
      const delayMs = computeBackoffDelay(
        nextAttempt,
        this.retryPolicy.initialDelayMs,
        this.retryPolicy.maxDelayMs,
        this.retryPolicy.backoffStrategy
      );

      await this.repository.update(jobId, {
        status: 'RETRY_PENDING',
        retryCount: nextAttempt,
        error: {
          code: errCode,
          message: errMsg,
          retryable: true,
        },
      });

      await this.leaseManager.releaseLease(jobId, this.workerId);
      await this.queue.requeue(receiptHandle, delayMs);

      this.telemetry?.recordJobRetry(job, nextAttempt);
    } else {
      // Dead letter
      await this.repository.update(jobId, {
        status: 'DEAD_LETTERED',
        completedAt: new Date().toISOString(),
        error: {
          code: errCode,
          message: errMsg,
          retryable: false,
        },
      });

      await this.deadLetterQueue.record({
        jobId,
        type: job.type,
        workspaceId: job.workspaceId,
        repositoryId: job.repositoryId,
        failureReason: errMsg,
        errorCode: errCode,
        retryCount: currentRetries,
        correlationId: job.correlationId,
        payload: job.payload,
      });

      await this.leaseManager.releaseLease(jobId, this.workerId);
      // Acknowledge from primary queue so bad job doesn't block processing
      await this.queue.acknowledge(receiptHandle);

      this.telemetry?.recordJobDeadLetter(job, errMsg);
    }
  }

  private async runLoop(): Promise<void> {
    while (this.isRunningLoop) {
      try {
        const processed = await this.processNext();
        if (!processed && this.isRunningLoop) {
          await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        }
      } catch {
        // Sleep on loop error
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
}
